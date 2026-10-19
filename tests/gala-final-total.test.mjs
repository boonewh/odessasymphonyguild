import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {finalDatabase} from './helpers/gala-final-database.mjs';
import {priceRequest} from '../lib/gala/backend/domain.ts';
import {ledgerReport} from '../lib/gala/backend/ledger.ts';
import {prepareFinal,finalSenderAvailable} from '../lib/gala/backend/final-total.ts';
import {syncReceipt} from '../lib/gala/backend/accounting.ts';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const mapping={realmId:'123',customerId:'10',itemId:'20',incomeAccountId:'30',clearingAccountId:'40'};
const input=()=>({requestId:randomUUID(),kind:'gifts',allSalesFinal:true,contact:{name:'Fictional Final Buyer',email:'final@example.com',phone:'4325550100'},gifts:[{student:'Fictional Student',grade:'12',roses:2,cookies:1}]});
async function setup(t){const c=await finalDatabase();t.after(()=>c.db.close());
  for(let i=0;i<2;i++){const q=priceRequest(input());await c.store.reserve(q);await c.store.apply(q.details.requestId,'cs_test_'+q.details.requestId,'paid','pi_'+q.details.requestId,'evt_'+q.details.requestId);}
  const source=await c.snapshot(),revision=ledgerReport(source).preview.revision;
  const p=prepareFinal(source,revision,randomUUID(),mapping);
  const receipts=[];let posts=0;
  const gateway={realmId:'123',find:async doc=>receipts.filter(r=>r.DocNumber===doc),create:async payload=>{posts++;const r={...payload,Id:'99',TotalAmt:payload.Line[0].Amount};receipts.push(r);return r;}};
  return {...c,p,receipts,gateway,get posts(){return posts;},send:()=>syncReceipt(c.totals,gateway,p.id,randomUUID(),async()=>{throw new Error('No recalculation');})};
}
test('final total freezes every paid item and membership, closes sales and leaves ledger readable',async t=>{
 const c=await setup(t);await c.totals.freeze(c.p);
 assert.equal((await c.totals.current()).amount,6000);assert.equal((await c.totals.current()).lines.length,4);
 assert.equal((await c.db.query('select * from gala_final_total_orders')).rows.length,2);
 assert.deepEqual(await c.snapshot(),c.p.source);
 await assert.rejects(c.store.reserve(priceRequest(input())),/sales closed/);
 await assert.rejects(c.rpc('gala_accounting_claim',[c.p.source.orders[0].id,randomUUID()]),/sales closed/);
 await assert.rejects(c.totals.freeze({...c.p,id:randomUUID()}),/already exists/);
 assert.equal(ledgerReport(await c.snapshot()).paidAmount,6000);
 const o=c.p.source.orders[0];
 await c.store.apply(o.id,o.stripe_session_id,'paid',o.payment_intent_id,'evt_late_verified_replay');
 assert.deepEqual(await c.snapshot(),c.p.source);
});
test('stale source, empty, unpaid and prior accounting records cannot form a final total',async t=>{
 const c=await setup(t);assert.throws(()=>prepareFinal(c.p.source,'a'.repeat(64),randomUUID(),mapping),/changed/);
 const q=priceRequest(input());await c.store.reserve(q);await assert.rejects(c.totals.freeze(c.p),/changed/);
 const source=await c.snapshot();assert.throws(()=>prepareFinal(source,ledgerReport(source).preview.revision,randomUUID(),mapping),/unpaid/);
 await c.store.apply(q.details.requestId,'cs_test_expire','expired',null,'evt_expire');
 await c.db.query("update gala_accounting_outbox set status='review' where order_id=$1",[c.p.source.orders[0].id]);
 const updated=await c.snapshot();assert.throws(()=>prepareFinal(updated,ledgerReport(updated).preview.revision,randomUUID(),mapping),/Earlier QuickBooks/);
 await assert.rejects(c.totals.freeze({...c.p,source:updated}),/Earlier accounting/);
});
test('concurrent requests and retries produce one aggregate receipt, never per-order receipts',async t=>{
 const c=await setup(t);await c.totals.freeze(c.p);await Promise.all([c.send(),c.send()]);await c.send();
 assert.equal(c.posts,1);assert.equal(c.receipts[0].Line.length,1);assert.equal(c.receipts[0].TotalAmt,60);
 assert.equal((await c.totals.current()).receipt_id,'99');assert.ok((await c.snapshot()).accounting.every(a=>a.status==='pending'));
});
test('lost response and failed database save recover the same aggregate by lookup',async t=>{
 const c=await setup(t);await c.totals.freeze(c.p);const create=c.gateway.create;
 c.gateway.create=async p=>{await create(p);throw new Error('lost response');};assert.equal(await c.send(),'review');
 const finish=c.totals.finish;c.totals.finish=async()=>{throw new Error('save failure');};assert.equal(await c.send(),'review');
 c.totals.finish=finish;assert.equal(await c.send(),'synced');assert.equal(c.posts,1);
});
test('uncertain dispatch without receipt stays in review without a second POST',async t=>{
 const c=await setup(t);await c.totals.freeze(c.p);let posts=0;c.gateway.create=async()=>{posts++;throw new Error('ambiguous');};
 assert.equal(await c.send(),'review');assert.equal(await c.send(),'review');assert.equal(posts,1);assert.ok((await c.totals.current()).dispatched_at);
});
test('wrong company, conflicting receipt and expired ownership cannot finalize a batch',async t=>{
 const c=await setup(t);await c.totals.freeze(c.p);c.gateway.realmId='999';assert.equal(await c.send(),'review');assert.equal(c.posts,0);
 c.gateway.realmId='123';c.receipts.push({...c.p.payload,Id:'9',TotalAmt:1});assert.equal(await c.send(),'review');assert.equal(c.posts,0);
 const owner=randomUUID();await c.totals.claim(c.p.id,owner);await c.db.query("update gala_final_total set lease_until=now()-interval '1 second'");
 await assert.rejects(c.totals.dispatch(c.p.id,owner));await assert.rejects(c.totals.finish(c.p.id,owner,'99'));
});
test('only server RPCs can mutate frozen totals; browser roles cannot read or execute',async t=>{
 const c=await setup(t);await c.totals.freeze(c.p);
 for(const role of ['anon','authenticated']){await c.db.exec('set role '+role);await assert.rejects(c.totals.current());await assert.rejects(c.totals.claim(c.p.id,randomUUID()));await c.db.exec('reset role');}
 await c.db.exec('set role service_role');assert.equal((await c.totals.current()).id,c.p.id);
 await assert.rejects(c.db.exec('delete from gala_final_total'));await assert.rejects(c.db.exec('update gala_final_total set amount=1'));await c.db.exec('reset role');
});
test('final sender remains blocked on hosted Preview and production',()=>{
 assert.equal(finalSenderAvailable({NODE_ENV:'production',GALA_QB_FINAL_ENABLED:'true'}),false);
 assert.equal(finalSenderAvailable({NODE_ENV:'development',GALA_BACKEND_ENABLED:'true',VERCEL:'1'}),false);
});
test('retired QuickBooks HTTP handlers reject connection, callbacks and sending even with old flags enabled',async()=>{
 const result=await promisify(execFile)(process.execPath,['--conditions=react-server','--import','tsx',fileURLToPath(new URL('./helpers/gala-final-route.mts',import.meta.url))],{timeout:30000,windowsHide:true});
 assert.match(result.stdout,/Final route checks passed/);
});
