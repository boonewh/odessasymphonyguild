import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { testDatabase } from './helpers/gala-database.mjs';
import { priceRequest } from '../lib/gala/backend/domain.ts';
import { startCheckout, reconcileSession, reconcilePending, sessionParameters } from '../lib/gala/backend/checkout.ts';
import { backendEnabled, readBackendConfig } from '../lib/gala/backend/config.ts';
import { parseWebhook } from '../lib/gala/backend/webhook.ts';

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
