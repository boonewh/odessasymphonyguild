import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import Stripe from 'stripe';
import { testDatabase } from './helpers/gala-database.mjs';
import { priceRequest } from '../lib/gala/backend/domain.ts';
import { startCheckout, reconcileSession, reconcilePending, sessionParameters } from '../lib/gala/backend/checkout.ts';
import { backendEnabled, readBackendConfig } from '../lib/gala/backend/config.ts';
import { parseWebhook, reconcileCheckoutEvent } from '../lib/gala/backend/webhook.ts';
import { createDevelopmentSession, validDevelopmentSession, authorizeLocalRequest, DEVELOPMENT_COOKIE } from '../lib/gala/backend/auth.ts';
import { recoveryPass, recoverOrder } from '../lib/gala/backend/recovery.ts';

const request = () => ({ requestId: randomUUID(), kind:'tables', allSalesFinal:true,
  contact:{name:'Fictional Buyer',email:'gala-test@example.com',phone:'4325550100'},
  purchase:{product:'gold',quantity:1,extraSeats:2} });
function gateway() {
  const sessions = new Map(); const intents = new Map(); const creations = new Map(); let calls=0;
  return {sessions, intents, creations, get calls(){return calls;},
    checkout:{sessions:{
      create:async (params, options) => {
        calls++;
        if (creations.has(options.idempotencyKey)) return creations.get(options.idempotencyKey);
        const session = {id:'cs_test_'+randomUUID(),mode:'payment',livemode:false,status:'open',payment_status:'unpaid',
          amount_total:params.line_items[0].price_data.unit_amount,currency:'usd',metadata:params.metadata,
          client_reference_id:params.client_reference_id,url:'https://checkout.stripe.com/test-only',payment_intent:null,recovered_from:null};
        sessions.set(session.id,session); creations.set(options.idempotencyKey,session); return session;
      },
      retrieve:async id => { if (!sessions.has(id)) throw new Error('missing'); return sessions.get(id); },
      expire:async id => { const s=sessions.get(id); if(s.status!=='open') throw new Error('cannot expire'); s.status='expired'; return s; },
    }}, paymentIntents:{retrieve:async id=>intents.get(id)},
  };
}
async function setup(t) { const ctx=await testDatabase(); t.after(()=>ctx.db.close()); return {...ctx, stripe:gateway()}; }

test('server prices ignore no client totals; consent, quantities and extra seats are enforced',()=>{
  const input=request(); assert.equal(priceRequest(input).amount,437500);
  const checkout=sessionParameters({id:input.requestId,details:input,amount:437500,description:'Gold table',created_at:new Date().toISOString()},'http://localhost:3000');
  assert.deepEqual(checkout.allowed_payment_method_types,['card']);
  assert.equal(checkout.wallet_options.link.display,'never');
  assert.equal(checkout.after_expiration.recovery.enabled,false);
  assert.throws(()=>priceRequest({...input,amount:1}));
  assert.throws(()=>priceRequest({...input,allSalesFinal:false}));
  assert.throws(()=>priceRequest({...input,purchase:{...input.purchase,extraSeats:3}}));
  const {purchase, ...giftInput}=input;
  assert.throws(()=>priceRequest({...giftInput,kind:'gifts',gifts:[]}));
  assert.equal(priceRequest({...giftInput,kind:'gifts',gifts:[{student:'Sample Student',grade:'9',roses:2,cookies:1}]}).amount,3000);
});
test('local gates reject production, Vercel previews, review mode and live keys',()=>{
  const env={NODE_ENV:'development',GALA_BACKEND_ENABLED:'true'};
  assert.equal(backendEnabled(env),true);
  for(const extra of [{NODE_ENV:'production'},{VERCEL_ENV:'preview'},{VERCEL:'1'},{GALA_CLIENT_REVIEW:'true'},{GALA_BACKEND_ENABLED:'false'}])
    assert.equal(backendEnabled({...env,...extra}),false);
  assert.throws(()=>readBackendConfig({...env,GALA_STRIPE_SECRET_KEY:'sk_live_fake'}));
});
test('local admin sessions require a valid unexpired signature and same-origin writes',()=>{
  const token='a'.repeat(64);const now=Date.now();const cookie=createDevelopmentSession(token,now);
  assert.equal(validDevelopmentSession(cookie,token,now),true);
  assert.equal(validDevelopmentSession(cookie,'b'.repeat(64),now),false);
  assert.equal(validDevelopmentSession(cookie,token,now+9*3600_000),false);
  assert.equal(validDevelopmentSession(cookie.slice(0,-1)+'z',token,now),false);
  const headers={cookie:`${DEVELOPMENT_COOKIE}=${cookie}`,origin:'http://localhost:3000'};
  assert.doesNotThrow(()=>authorizeLocalRequest(new Request('http://localhost:3000/api/gala/checkout',{method:'POST',headers}),token,'http://localhost:3000'));
  assert.throws(()=>authorizeLocalRequest(new Request('http://localhost:3000/api/gala/checkout',{method:'POST',headers:{...headers,origin:'https://attacker.example'}}),token,'http://localhost:3000'));
  assert.throws(()=>authorizeLocalRequest(new Request('http://localhost:3000/api/gala/orders'),token,'http://localhost:3000'));
  assert.doesNotThrow(()=>authorizeLocalRequest(new Request('http://localhost:3000/api/gala/orders',{headers:{'x-gala-development-token':token}}),token,'http://localhost:3000'));
});
test('database enforces last available table, repeated request IDs and changed payload conflicts',async t=>{
  const {db,store}=await setup(t); await db.exec("update gala_inventory set capacity=1 where tier='gold'");
  const input=request(); const q=priceRequest(input);
  const results=await Promise.allSettled([store.reserve(q),store.reserve(priceRequest(request()))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const first=await store.reserve(q); assert.equal(first.id,input.requestId);
  await assert.rejects(store.reserve(priceRequest({...input,contact:{...input.contact,name:'Different Buyer'}})));
  await db.exec("update gala_orders set created_at=now()-interval '2 days'");
  await assert.rejects(store.reserve(priceRequest(request())));
});
test('lost create response reuses the identical Stripe attempt; late retries never create anew',async t=>{
  const {store,stripe,db}=await setup(t); const input=request();
  const original=stripe.checkout.sessions.create; let lost=true;
  stripe.checkout.sessions.create=async(...args)=>{const result=await original(...args); if(lost){lost=false;throw new Error('lost response');}return result;};
  await assert.rejects(startCheckout(store,stripe,input,'http://localhost:3000'));
  const recovered=await startCheckout(store,stripe,input,'http://localhost:3000');
  assert.equal(stripe.creations.size,1); assert.ok(recovered.url);
  await startCheckout(store,stripe,input,'http://localhost:3000'); assert.equal(stripe.calls,2);
  const old=request(); await store.reserve(priceRequest(old));
  await db.query("update gala_orders set created_at=now()-interval '25 hours' where id=$1",[old.requestId]);
  await assert.rejects(startCheckout(store,stripe,old,'http://localhost:3000')); assert.equal(stripe.calls,2);
});
test('verified payment is applied once, queues one accounting entry, and cannot become expired',async t=>{
  const {store,stripe,db}=await setup(t); const input=request();
  await startCheckout(store,stripe,input,'http://localhost:3000');
  const s=[...stripe.sessions.values()][0]; s.status='complete';s.payment_status='paid';s.payment_intent='pi_test_paid';
  stripe.intents.set(s.payment_intent,{id:s.payment_intent,livemode:false,status:'succeeded',amount:437500,amount_received:437500,currency:'usd',metadata:s.metadata});
  assert.equal(await reconcileSession(store,stripe,s.id,'evt_paid'),'paid');
  await reconcileSession(store,stripe,s.id,'evt_paid'); await reconcileSession(store,stripe,s.id,'evt_duplicate');
  assert.equal((await db.query('select * from gala_accounting_outbox')).rows.length,1);
  assert.equal((await store.get(input.requestId)).status,'paid');
  s.status='expired';s.payment_status='unpaid';s.payment_intent=null;
  await assert.rejects(reconcileSession(store,stripe,s.id,'evt_stale_expired'));
  assert.equal((await store.get(input.requestId)).status,'paid');
});
test('expired checkout releases inventory, but pending payments and provider outages do not',async t=>{
  const {db,store,stripe}=await setup(t); await db.exec("update gala_inventory set capacity=1 where tier='gold'");
  const input=request();await startCheckout(store,stripe,input,'http://localhost:3000');
  const s=[...stripe.sessions.values()][0];s.status='complete';s.payment_status='unpaid';
  assert.equal(await reconcileSession(store,stripe,s.id,'evt_pending'),'pending');
  await assert.rejects(store.reserve(priceRequest(request())));
  s.status='expired';s.payment_intent='pi_processing';stripe.intents.set('pi_processing',{status:'processing',livemode:false});
  assert.equal(await reconcileSession(store,stripe,s.id,'evt_uncertain'),'pending');
  s.payment_intent=null;assert.equal(await reconcileSession(store,stripe,s.id,'evt_expired'),'expired');
  await store.reserve(priceRequest(request()));
  assert.equal((await db.query('select * from gala_accounting_outbox')).rows.length,0);
});
test('wrong amount, currency, account mode, payment and session references cannot mark paid',async t=>{
  const {store,stripe}=await setup(t);const input=request();await startCheckout(store,stripe,input,'http://localhost:3000');
  const s=[...stripe.sessions.values()][0];
  for(const patch of [{amount_total:1},{currency:'eur'},{livemode:true},{client_reference_id:randomUUID()},{recovered_from:'cs_test_old'}]) {
    const original={...s};Object.assign(s,patch);await assert.rejects(reconcileSession(store,stripe,s.id,randomUUID()));Object.assign(s,original);
  }
  s.status='complete';s.payment_status='paid';s.payment_intent='pi_wrong';
  stripe.intents.set('pi_wrong',{id:'pi_wrong',status:'succeeded',livemode:false,amount:437500,amount_received:100,currency:'usd',metadata:s.metadata});
  await assert.rejects(reconcileSession(store,stripe,s.id,'evt_bad_payment'));
  assert.equal((await store.get(input.requestId)).status,'awaiting_payment');
});
test('webhook before checkout binding does not regress a paid order',async t=>{
  const {store}=await setup(t);const input=request();await store.reserve(priceRequest(input));
  await store.apply(input.requestId,'cs_test_early','paid','pi_early','evt_early');
  assert.equal((await store.bind(input.requestId,'cs_test_early')).status,'paid');
  await assert.rejects(store.bind(input.requestId,'cs_test_second'));
});

test('canceled intents must match the order and contain no received funds before inventory release',async t=>{
  const {store,stripe,db}=await setup(t);await db.exec("update gala_inventory set capacity=1 where tier='gold'");
  const input=request();await startCheckout(store,stripe,input,'http://localhost:3000');
  const session=[...stripe.sessions.values()][0];session.status='expired';session.payment_intent='pi_canceled';
  const valid={id:session.payment_intent,status:'canceled',livemode:false,amount:437500,amount_received:0,currency:'usd',metadata:{...session.metadata}};
  for(const patch of [{id:'pi_other'},{amount:1},{currency:'eur'},{amount_received:100},
    {metadata:{...valid.metadata,gala_order_id:randomUUID()}},{metadata:{...valid.metadata,application:'other'}}]){
    stripe.intents.set(session.payment_intent,{...valid,...patch});
    await assert.rejects(reconcileSession(store,stripe,session.id,randomUUID()));
    assert.equal((await store.get(input.requestId)).status,'awaiting_payment');
    await assert.rejects(store.reserve(priceRequest(request())));
  }
  stripe.intents.set(session.payment_intent,valid);
  assert.equal(await reconcileSession(store,stripe,session.id,'evt_valid_cancel'),'expired');
  await store.reserve(priceRequest(request()));assert.equal(await accountingCount(db,input.requestId),0);
});

test('a paid intent with the wrong retrieved identity cannot settle an order',async t=>{
  const {store,stripe,db}=await setup(t);const input=request();await startCheckout(store,stripe,input,'http://localhost:3000');
  const session=[...stripe.sessions.values()][0];settle(stripe,session);
  stripe.intents.get(session.payment_intent).id='pi_different';
  await assert.rejects(reconcileSession(store,stripe,session.id,'evt_wrong_identity'));
  assert.equal((await store.get(input.requestId)).status,'awaiting_payment');
  assert.equal(await accountingCount(db,input.requestId),0);
});
test('database denies browser roles access to records and reservation functions',async t=>{
  const {db}=await setup(t);
  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from gala_orders'));
    await assert.rejects(db.query("select gala_bind_checkout($1,'cs_test_fake')",[randomUUID()]));
    await db.exec('reset role');
  }
});
test('signatures reject tampering, stale signatures, live and connected-account events',()=>{
  const stripe=new Stripe('sk_test_fake');const secret='whsec_test';
  const make=(patch={})=>JSON.stringify({id:'evt_test',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test_sample'}},...patch});
  const body=make();const sign=(payload,timestamp)=>stripe.webhooks.generateTestHeaderString({payload,secret,...(timestamp?{timestamp}: {})});
  assert.equal(parseWebhook(stripe,body,sign(body),secret).id,'evt_test');
  assert.throws(()=>parseWebhook(stripe,body+' ',sign(body),secret));
  assert.throws(()=>parseWebhook(stripe,body,sign(body,1),secret));
  for(const patch of [{livemode:true},{account:'acct_other'}]) {const b=make(patch);assert.throws(()=>parseWebhook(stripe,b,sign(b),secret));}
});
test('reconciliation retains an uncertain hold and never creates a replacement checkout',async t=>{
  const {store,stripe}=await setup(t);const input=request();await startCheckout(store,stripe,input,'http://localhost:3000');
  stripe.checkout.sessions.expire=async()=>{throw new Error('network outage');};
  const result=await reconcilePending(store,stripe,Date.now()+3600_000);
  assert.equal(result[0].state,'retry_required');assert.equal((await store.get(input.requestId)).status,'awaiting_payment');
  assert.equal(stripe.creations.size,1);
});

function settle(stripe,session) {
  Object.assign(session,{status:'complete',payment_status:'paid',payment_intent:'pi_'+randomUUID()});
  stripe.intents.set(session.payment_intent,{id:session.payment_intent,livemode:false,status:'succeeded',amount:session.amount_total,
    amount_received:session.amount_total,currency:'usd',metadata:session.metadata});
}
async function accountingCount(db,id) {return (await db.query('select count(*)::int as n from gala_accounting_outbox where order_id=$1',[id])).rows[0].n;}

test('payment winning the expiry race retains stock until retry verifies payment, with one accounting job',async t=>{
  const {store,stripe,db}=await setup(t);await db.exec("update gala_inventory set capacity=1 where tier='gold'");
  const input=request();await startCheckout(store,stripe,input,'http://localhost:3000');const session=[...stripe.sessions.values()][0];
  stripe.checkout.sessions.expire=async()=>{settle(stripe,session);throw new Error('payment completed before expire');};
  assert.equal((await reconcilePending(store,stripe,Date.now()+3600_000))[0].state,'retry_required');
  await assert.rejects(store.reserve(priceRequest(request())));
  assert.equal(await accountingCount(db,input.requestId),0);
  assert.equal((await reconcilePending(store,stripe,Date.now()+3600_000))[0].state,'paid');
  assert.equal(await accountingCount(db,input.requestId),1);
  await assert.rejects(store.reserve(priceRequest(request())));assert.equal(stripe.creations.size,1);
});

test('lost expiration response and stale open checkout cannot release or replace a hold before verification',async t=>{
  const {store,stripe,db}=await setup(t);await db.exec("update gala_inventory set capacity=1 where tier='gold'");
  const input=request();await startCheckout(store,stripe,input,'http://localhost:3000');const session=[...stripe.sessions.values()][0];
  const expire=stripe.checkout.sessions.expire;
  stripe.checkout.sessions.expire=async(...args)=>{await expire(...args);throw new Error('lost expiration response');};
  assert.equal((await reconcilePending(store,stripe,Date.now()+3600_000))[0].state,'retry_required');
  await assert.rejects(store.reserve(priceRequest(request())));
  await assert.rejects(startCheckout(store,stripe,input,'http://localhost:3000'));
  assert.equal(stripe.creations.size,1);
  assert.equal((await reconcilePending(store,stripe,Date.now()+3600_000))[0].state,'expired');
  await store.reserve(priceRequest(request()));assert.equal(await accountingCount(db,input.requestId),0);
});

test('database failure before payment save and lost response after commit both recover without double accounting',async t=>{
  for(const committed of [false,true]){
    const {store,stripe,db}=await setup(t);const input=request();await startCheckout(store,stripe,input,'http://localhost:3000');
    const session=[...stripe.sessions.values()][0];settle(stripe,session);
    const failing={...store,apply:async(...args)=>{if(committed)await store.apply(...args);throw new Error('database connection lost');}};
    await assert.rejects(reconcileSession(failing,stripe,session.id,'evt_db_'+committed));
    assert.equal((await store.get(input.requestId)).status,committed?'paid':'awaiting_payment');
    assert.equal(await accountingCount(db,input.requestId),committed?1:0);
    await Promise.all(Array.from({length:8},(_,i)=>reconcileSession(store,stripe,session.id,i<4?'evt_db_'+committed:'evt_retry_'+i)));
    assert.equal((await store.get(input.requestId)).status,'paid');assert.equal(await accountingCount(db,input.requestId),1);
  }
});

test('out-of-order signed notifications use current provider state and duplicate deliveries remain harmless',async t=>{
  const {store,stripe,db}=await setup(t);const input=request();await startCheckout(store,stripe,input,'http://localhost:3000');
  const session=[...stripe.sessions.values()][0],sdk=new Stripe('sk_test_fake'),secret='whsec_test';
  const deliver=async(type,id)=>{const body=JSON.stringify({id,type,livemode:false,data:{object:{id:session.id,status:'expired',payment_status:'unpaid',amount_total:1}}});
    const signature=sdk.webhooks.generateTestHeaderString({payload:body,secret});
    return reconcileCheckoutEvent(store,stripe,parseWebhook(sdk,body,signature,secret));};
  assert.equal(await deliver('checkout.session.completed','evt_early'),'pending');
  assert.equal((await db.query('select * from gala_payment_events')).rows.length,0);
  settle(stripe,session);
  for(const type of ['checkout.session.expired','checkout.session.async_payment_failed','checkout.session.completed','checkout.session.async_payment_succeeded'])
    assert.equal(await deliver(type,'evt_'+type),'paid');
  await Promise.all(Array.from({length:12},()=>deliver('checkout.session.completed','evt_early')));
  assert.equal((await store.get(input.requestId)).status,'paid');assert.equal(await accountingCount(db,input.requestId),1);
  assert.equal((await db.query("select count(*)::int as n from gala_payment_events where event_id='evt_early'")).rows[0].n,1);
  assert.equal(await deliver('customer.created','evt_unrelated'),'ignored');
});

test('session and payment lookups failing hold inventory; healthy orders still reconcile in the same pass',async t=>{
  const {store,stripe,db}=await setup(t);const inputs=[request(),request(),request()];
  for(const input of inputs)await startCheckout(store,stripe,input,'http://localhost:3000');
  const sessions=[...stripe.sessions.values()];sessions.forEach(s=>settle(stripe,s));
  const retrieve=stripe.checkout.sessions.retrieve,paymentRetrieve=stripe.paymentIntents.retrieve;
  stripe.checkout.sessions.retrieve=async id=>{if(id===sessions[0].id)throw new Error('Stripe unreachable');return retrieve(id);};
  stripe.paymentIntents.retrieve=async id=>{if(id===sessions[1].payment_intent)throw new Error('payment lookup unavailable');return paymentRetrieve(id);};
  const result=await reconcilePending(store,stripe);
  assert.equal(result.filter(r=>r.state==='retry_required').length,2);assert.equal(result.filter(r=>r.state==='paid').length,1);
  for(let i=0;i<3;i++)assert.equal(await accountingCount(db,inputs[i].requestId),i===2?1:0);
  stripe.checkout.sessions.retrieve=retrieve;stripe.paymentIntents.retrieve=paymentRetrieve;
  assert.equal((await reconcilePending(store,stripe)).filter(r=>r.state==='paid').length,2);
  for(const input of inputs)assert.equal(await accountingCount(db,input.requestId),1);
});

test('unpaid, processing and non-canceled expired intents never free stock',async t=>{
  const {store,stripe,db}=await setup(t);await db.exec("update gala_inventory set capacity=1 where tier='gold'");
  const input=request();await startCheckout(store,stripe,input,'http://localhost:3000');const session=[...stripe.sessions.values()][0];
  session.status='expired';session.payment_intent='pi_uncertain';
  for(const status of ['processing','requires_action','requires_payment_method','requires_capture','succeeded']){
    stripe.intents.set(session.payment_intent,{id:session.payment_intent,status,livemode:false});
    assert.equal(await reconcileSession(store,stripe,session.id,'evt_'+status),'pending');
    await assert.rejects(store.reserve(priceRequest(request())));
  }
  assert.equal(await accountingCount(db,input.requestId),0);
});

test('larger reservation burst and repeated checkout submissions respect capacity and reuse one session',async t=>{
  const {store,stripe,db}=await setup(t);await db.exec("update gala_inventory set capacity=3 where tier='gold'");
  const inputs=Array.from({length:24},request);
  const results=await Promise.allSettled(inputs.map(input=>store.reserve(priceRequest(input))));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,3);
  const winner=inputs[results.findIndex(r=>r.status==='fulfilled')];
  const attempts=await Promise.all(Array.from({length:12},()=>startCheckout(store,stripe,winner,'http://localhost:3000')));
  assert.equal(new Set(attempts.map(r=>r.orderId)).size,1);assert.equal(stripe.creations.size,1);
  const session=[...stripe.sessions.values()][0];session.status='expired';
  await reconcileSession(store,stripe,session.id,'evt_release');
  const replacements=await Promise.allSettled(Array.from({length:16},()=>store.reserve(priceRequest(request()))));
  assert.equal(replacements.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await db.query("select count(*)::int as n from gala_orders where status<>'expired'")).rows[0].n,3);
});

test('database binding failure after provider creation retries the same session even if payment arrives first',async t=>{
  const {store,stripe,db}=await setup(t);const input=request();
  await assert.rejects(startCheckout({...store,bind:async()=>{throw new Error('binding unavailable');}},stripe,input,'http://localhost:3000'));
  const session=[...stripe.sessions.values()][0];assert.equal((await store.get(input.requestId)).stripe_session_id,null);
  settle(stripe,session);await reconcileSession(store,stripe,session.id,'evt_before_bind');
  await assert.rejects(startCheckout(store,stripe,input,'http://localhost:3000'));
  assert.equal(stripe.creations.size,1);assert.equal(await accountingCount(db,input.requestId),1);
  assert.equal((await store.get(input.requestId)).stripe_session_id,session.id);
});

async function recoverySetup(t){
  const ctx=await setup(t);await ctx.db.exec(await readFile(new URL('../supabase/gala-development/008_gala_payment_recovery.sql',import.meta.url),'utf8'));
  const rpc=async(name,args=[])=>(await ctx.db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;
  return {...ctx,rpc,queue:{claim:token=>rpc('gala_claim_recovery',[token]),finish:(...args)=>rpc('gala_finish_recovery',args)}};
}
test('durable recovery schedules beyond 100 orders without letting old unknown checkouts starve the rest',async t=>{
  const {db,store,stripe,queue,rpc}=await recoverySetup(t);
  await db.exec(`insert into gala_orders(id,request_hash,details,amount,description,created_at)
    select gen_random_uuid(),'fixture','{}',100,'Fictional queue test',now()-interval '1 hour' from generate_series(1,125)`);
  for(let i=0;i<13;i++)await recoveryPass(queue,store,stripe);
  assert.equal((await db.query("select count(*)::int as n from gala_payment_recovery where outcome='creation_needs_review' and attempts=1")).rows[0].n,125);
  const dashboard=await rpc('gala_recovery_dashboard');assert.equal(dashboard.total,125);assert.equal(dashboard.entries.length,100);assert.ok(dashboard.lastPollAt);
  assert.equal((await recoveryPass(queue,store,stripe)).checked,0);assert.equal(stripe.creations.size,0);
});
test('recovery leases prevent double claims, expire after worker loss, and reject stale completion',async t=>{
  const {db,store,queue}=await recoverySetup(t);const input=request();await store.reserve(priceRequest(input));
  const a=randomUUID(),b=randomUUID();const claims=await Promise.all([queue.claim(a),queue.claim(b)]);
  assert.equal(claims.filter(Boolean).length,1);const old=claims[0]?a:b;
  await db.exec("update gala_payment_recovery set lease_until=now()-interval '1 second'");
  const next=randomUUID();assert.equal((await queue.claim(next)).id,input.requestId);
  await assert.rejects(queue.finish(input.requestId,old,'pending'));
  await assert.rejects(queue.finish(input.requestId,next,'paid'));
  await queue.finish(input.requestId,next,'pending');
  assert.equal((await db.query('select attempts from gala_payment_recovery')).rows[0].attempts,2);
});
test('recovery failures back off durably, manual retries require reasons and leave an audit without releasing stock',async t=>{
  const {db,store,queue,rpc}=await recoverySetup(t);const input=request();await store.reserve(priceRequest(input));
  for(let i=1;i<=3;i++){
    const token=randomUUID();await queue.claim(token);await queue.finish(input.requestId,token,'retry_required');
    const row=(await db.query('select *,extract(epoch from next_check_at-last_checked_at)::int as delay from gala_payment_recovery')).rows[0];
    assert.equal(row.failures,i);assert.equal(row.delay,60*2**(i-1));
    await assert.rejects(rpc('gala_retry_recovery',[input.requestId,'x']));
    await rpc('gala_retry_recovery',[input.requestId,'Connection checked; retry verification']);
  }
  assert.equal((await db.query('select * from gala_recovery_actions')).rows.length,3);
  assert.equal((await store.get(input.requestId)).status,'reserved');
  const token=randomUUID();await queue.claim(token);await assert.rejects(rpc('gala_retry_recovery',[input.requestId,'Already running']));
  await queue.finish(input.requestId,token,'pending');
});
test('worker settles verified paid and expired orders while pending or missing sessions retain holds',async t=>{
  const {db,store,stripe,queue,rpc}=await recoverySetup(t);const inputs=Array.from({length:4},request);
  for(const input of inputs.slice(0,3))await startCheckout(store,stripe,input,'http://localhost:3000');
  await store.reserve(priceRequest(inputs[3]));
  const sessions=[...stripe.sessions.values()];settle(stripe,sessions[0]);sessions[1].status='expired';
  const before=stripe.creations.size;assert.equal((await recoveryPass(queue,store,stripe)).checked,4);
  assert.deepEqual(await Promise.all(inputs.map(async input=>(await store.get(input.requestId)).status)),['paid','expired','awaiting_payment','reserved']);
  assert.equal(stripe.creations.size,before);assert.equal(await accountingCount(db,inputs[0].requestId),1);
  assert.equal((await rpc('gala_recovery_dashboard')).total,2);
  await assert.rejects(rpc('gala_retry_recovery',[inputs[0].requestId,'Already paid']));
});
test('recovery re-reads when payment wins expiry or the expiration response is lost',async t=>{
  const {db,store,stripe,queue}=await recoverySetup(t);const inputs=[request(),request()];
  for(const input of inputs)await startCheckout(store,stripe,input,'http://localhost:3000');
  await db.exec("update gala_orders set created_at=now()-interval '1 hour'");
  const sessions=[...stripe.sessions.values()];stripe.checkout.sessions.expire=async id=>{
    if(id===sessions[0].id)settle(stripe,sessions[0]);else sessions[1].status='expired';throw new Error('Lost expiry race/response');
  };
  await recoveryPass(queue,store,stripe);
  assert.equal((await store.get(inputs[0].requestId)).status,'paid');assert.equal((await store.get(inputs[1].requestId)).status,'expired');
  assert.equal(await accountingCount(db,inputs[0].requestId),1);
});
test('lost recovery completion resumes after lease expiry and webhook settlement clears an old failure',async t=>{
  const {db,store,stripe,queue}=await recoverySetup(t);const input=request();await startCheckout(store,stripe,input,'http://localhost:3000');
  settle(stripe,[...stripe.sessions.values()][0]);
  await assert.rejects(recoveryPass({...queue,finish:async()=>{throw new Error('Worker terminated before queue save');}},store,stripe));
  assert.equal((await store.get(input.requestId)).status,'paid');
  await db.exec("update gala_payment_recovery set lease_until=now()-interval '1 second'");
  await recoveryPass(queue,store,stripe);
  assert.equal((await db.query('select outcome from gala_payment_recovery')).rows[0].outcome,'paid');
  assert.equal(await accountingCount(db,input.requestId),1);
});
test('recovery tables and functions reject browser roles, while service role can claim and audit retry',async t=>{
  const {db,store,rpc}=await recoverySetup(t);const input=request();await store.reserve(priceRequest(input));
  for(const role of ['anon','authenticated']){
    await db.exec(`set role ${role}`);
    for(const name of ['gala_payment_recovery','gala_recovery_worker','gala_recovery_actions'])await assert.rejects(db.query('select * from '+name));
    await assert.rejects(rpc('gala_claim_recovery',[randomUUID()]));await assert.rejects(rpc('gala_recovery_dashboard'));
    await assert.rejects(rpc('gala_retry_recovery',[input.requestId,'Unauthorized retry']));await db.exec('reset role');
  }
  await db.exec('set role service_role');await rpc('gala_retry_recovery',[input.requestId,'Local admin checked connection']);
  assert.equal((await rpc('gala_claim_recovery',[randomUUID()])).id,input.requestId);await db.exec('reset role');
});
