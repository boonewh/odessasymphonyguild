// Explicit, opt-in development exercise. No charges, accounting sync or production writes.
// node --env-file=.env.local --import tsx scripts/gala-payment-failures.mts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { readBackendConfig, DEVELOPMENT_STRIPE_ACCOUNT } from "../lib/gala/backend/config";
import { SupabaseOrderStore } from "../lib/gala/backend/store";
import { priceRequest, type OrderStore } from "../lib/gala/backend/domain";
import { startCheckout, reconcileSession, reconcilePending, type StripeGateway } from "../lib/gala/backend/checkout";
import { testDatabase } from "../tests/helpers/gala-database.mjs";
import { reconcileCheckoutEvent } from "../lib/gala/backend/webhook";

async function main() {
  const config=readBackendConfig({...process.env,NODE_ENV:"development"});
  const stripe=new Stripe(config.key,{maxNetworkRetries:2,timeout:20000});
  assert.equal((await stripe.accounts.retrieveCurrent()).id,DEVELOPMENT_STRIPE_ACCOUNT);
  const store=new SupabaseOrderStore(config.url,config.dbKey);await store.verifyEnvironment();
  const db=createClient(config.url,config.dbKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const check=async<T,>(result:{data:T;error:unknown})=>{assert.ifError(result.error);assert.ok(result.data!==null);return result.data;};
  const stock=await check(await db.from('gala_inventory').select('*').eq('tier','platinum').single());
  assert.equal(stock.capacity,20);assert.equal(stock.board_confirmed,false);
  const occupied=await check(await db.from('gala_orders').select('id').eq('tier','platinum').neq('status','expired'));
  assert.equal(occupied.length,0,'Platinum must have no active orders for this test.');
  const runId=randomUUID(),sessions=new Set<string>();
  const inputs=Array.from({length:24},()=>({requestId:randomUUID(),kind:'tables',allSalesFinal:true,
    contact:{name:'Fictional Failure Test',email:'gala-failures@example.com',phone:'4325550100'},
    purchase:{product:'platinum',quantity:1,extraSeats:0}}));
  let winners:typeof inputs=[];
  // Include ambiguous reservation responses in cleanup by looking up every run-owned ID.
  const runOrders=async()=>check(await db.from('gala_orders').select('*').in('id',inputs.map(i=>i.requestId)));
  const scoped:OrderStore={reserve:q=>store.reserve(q),get:id=>store.get(id),bind:(...args)=>store.bind(...args),
    apply:(...args)=>store.apply(...args),pending:async()=>(await runOrders()).filter(o=>['reserved','awaiting_payment'].includes(o.status))};
  try {
    await check(await db.from('gala_inventory').update({capacity:3}).eq('tier','platinum').select());
    console.log(`Development failure run ${runId}; temporarily testing 3 Platinum slots. Restores unapproved capacity 20.`);
    const raced=await Promise.allSettled(inputs.map(input=>store.reserve(priceRequest(input))));
    winners=inputs.filter((_,i)=>raced[i].status==='fulfilled');
    assert.equal(winners.length,3);assert.equal((await runOrders()).length,3);
    console.log('PASS: 24 independent hosted reservations compete for 3 slots; exactly 3 succeed.');
    let loseCreation=true;
    const faulted={checkout:{sessions:{create:async(...args:Parameters<typeof stripe.checkout.sessions.create>)=>{
      const session=await stripe.checkout.sessions.create(...args);sessions.add(session.id);
      if(loseCreation){loseCreation=false;throw new Error('Injected response loss after real Stripe creation');}return session;
    },retrieve:stripe.checkout.sessions.retrieve.bind(stripe.checkout.sessions),expire:stripe.checkout.sessions.expire.bind(stripe.checkout.sessions)}},
    paymentIntents:stripe.paymentIntents} as unknown as StripeGateway;
    await assert.rejects(startCheckout(store,faulted,winners[0],config.origin));
    await startCheckout(store,faulted,winners[0],config.origin);
    assert.equal(sessions.size,1);
    const repeated=await Promise.all(Array.from({length:8},()=>startCheckout(store,stripe,winners[0],config.origin)));
    assert.equal(new Set(repeated.map(r=>r.url)).size,1);
    for(const input of winners.slice(1))await startCheckout(store,stripe,input,config.origin);
    for(const order of await runOrders())sessions.add(order.stripe_session_id);
    assert.equal(sessions.size,3);
    console.log('PASS: real Stripe create response loss and 8 repeat submissions reuse the original checkout.');
    const sessionIds=[...sessions];
    const unavailable={...faulted,checkout:{sessions:{...faulted.checkout.sessions,retrieve:async()=>{throw new Error('Injected transport outage');}}}} as unknown as StripeGateway;
    const outage=await reconcilePending(scoped,unavailable);
    assert.ok(outage.every(r=>r.state==='retry_required'));
    assert.ok((await runOrders()).every(o=>o.status==='awaiting_payment'));
    const rejectedInput=inputs.find(input=>!winners.some(winner=>winner.requestId===input.requestId))!;
    await assert.rejects(store.reserve(priceRequest(rejectedInput)));
    console.log('PASS: injected provider lookup outage retains all three hosted holds.');
    // Response-loss injection wraps a real expiration, not a fabricated provider state.
    const lostExpiry={...faulted,checkout:{sessions:{...faulted.checkout.sessions,expire:async(...args:Parameters<typeof stripe.checkout.sessions.expire>)=>{
      await stripe.checkout.sessions.expire(...args);throw new Error('Injected expiration response loss');
    }}}} as unknown as StripeGateway;
    const uncertain=await reconcilePending(scoped,lostExpiry,Date.now()+3600_000);
    assert.ok(uncertain.every(r=>r.state==='retry_required'));
    assert.ok((await runOrders()).every(o=>o.status==='awaiting_payment'));
    const beforeSave={...scoped,apply:async()=>{throw new Error('Injected failure before database save');}};
    await assert.rejects(reconcileSession(beforeSave,stripe,sessionIds[0],`failure-before-${runId}`));
    const afterSave={...scoped,apply:async(...args:Parameters<OrderStore['apply']>)=>{await store.apply(...args);throw new Error('Injected response loss after database commit');}};
    await assert.rejects(reconcileSession(afterSave,stripe,sessionIds[1],`failure-after-${runId}`));
    await reconcilePending(scoped,stripe);
    assert.ok((await runOrders()).every(o=>o.status==='expired'));
    console.log('PASS: real expirations with lost responses and before/after database-save faults recover on retry.');
    // Re-signed synthetic envelopes test HTTP handling; Stripe supplies the actual current state.
    for(const [i,type] of ['checkout.session.completed','checkout.session.expired','checkout.session.async_payment_failed'].entries()){
      const body=JSON.stringify({id:`evt_failure_${runId}_${i}`,type,livemode:false,
        data:{object:{id:sessionIds[0],status:'complete',payment_status:'paid',amount_total:1}}});
      const headers={'Content-Type':'application/json','stripe-signature':stripe.webhooks.generateTestHeaderString({payload:body,secret:config.webhookSecret})};
      const responses=await Promise.all(Array.from({length:3},()=>fetch(config.origin+'/api/gala/webhook',{method:'POST',headers,body})));
      assert.ok(responses.every(r=>r.status===200));
    }
    const queued=await check(await db.from('gala_accounting_outbox').select('order_id').in('order_id',winners.map(i=>i.requestId)));
    assert.equal(queued.length,0);
    assert.ok((await runOrders()).every(o=>o.status==='expired'));
    console.log('PASS: 9 signed HTTP deliveries with stale/conflicting payloads retain verified expired state and create no accounting.');
    // Replay an existing real paid sandbox checkout into disposable SQL only; hosted paid records stay untouched.
    const paid=await check(await db.from('gala_orders').select('*').eq('status','paid').limit(1).single());
    const local=await testDatabase();
    try {
      await local.store.reserve(priceRequest(paid.details));await local.store.bind(paid.id,paid.stripe_session_id);
      for(const type of ['checkout.session.expired','checkout.session.async_payment_failed','checkout.session.completed']){
        await reconcileCheckoutEvent(local.store,stripe,{id:`evt_replay_${runId}_${type}`,type,data:{object:{id:paid.stripe_session_id,status:'expired'}}} as Stripe.Event);
      }
      assert.equal((await local.store.get(paid.id)).status,'paid');
      assert.equal((await local.db.query('select * from gala_accounting_outbox')).rows.length,1);
      console.log('PASS: real paid Stripe session/intent re-read across out-of-order envelopes produces one disposable local accounting job.');
    } finally {await local.db.close();}
  } finally {
    // Never release inventory by inventing expiration. Recover/expire only this run's real checkouts.
    try {
      for(const order of await runOrders()){
        let sessionId=order.stripe_session_id;
        if(!sessionId){const input=inputs.find(i=>i.requestId===order.id)!;await startCheckout(store,stripe,input,config.origin);sessionId=(await store.get(order.id)).stripe_session_id;}
        assert.ok(sessionId);const session=await stripe.checkout.sessions.retrieve(sessionId);
        if(session.status==='open')await stripe.checkout.sessions.expire(sessionId);
        await reconcileSession(store,stripe,sessionId,`failure-cleanup-${runId}-${order.id}`);
      }
      assert.ok((await runOrders()).every(o=>o.status==='expired'));
    } finally {
      await check(await db.from('gala_inventory').update({capacity:stock.capacity}).eq('tier','platinum').select());
      const restored=await check(await db.from('gala_inventory').select('*').eq('tier','platinum').single());
      assert.deepEqual(restored,stock);
      console.log('Restored original unapproved Platinum inventory. Fictional expired orders retained for audit.');
    }
  }
}
main().catch(()=>{console.error('Payment failure exercise failed. Inspect run-owned development orders before repeating. No credentials printed.');process.exitCode=1;});
