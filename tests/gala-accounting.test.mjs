import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { testDatabase } from './helpers/gala-database.mjs';
import { priceRequest } from '../lib/gala/backend/domain.ts';
import { receiptFor, verifyReceipt, syncReceipt } from '../lib/gala/backend/accounting.ts';
import { sealTokens, openTokens } from '../lib/gala/backend/qb-tokens.ts';
import { readQbConfig } from '../lib/gala/backend/qb-config.ts';
import { SandboxQuickBooks } from '../lib/gala/backend/qb-client.ts';

const mapping={realmId:'123',customerId:'10',itemId:'20',incomeAccountId:'30',clearingAccountId:'40'};
const paymentTime=Date.parse('2026-10-02T01:30:00Z')/1000;
const input=()=>({requestId:randomUUID(),kind:'tables',allSalesFinal:true,contact:{name:'Sandbox Buyer',email:'test@example.com',phone:'4325550100'},purchase:{product:'gold',quantity:1,extraSeats:2}});
async function setup(t) {
  const ctx=await testDatabase(); t.after(()=>ctx.db.close());
  await ctx.db.exec(await readFile(new URL('../supabase/gala-development/002_gala_accounting.sql',import.meta.url),'utf8'));
  const request=input(); await ctx.store.reserve(priceRequest(request));
  const order=await ctx.store.apply(request.requestId,'cs_test_accounting','paid','pi_test_accounting','evt_accounting');
  const rpc=async(name,args)=>(await ctx.db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;
  const store={
    claim:(id,owner)=>rpc('gala_accounting_claim',[id,owner]),
    prepare:(id,owner,realm,payload)=>rpc('gala_accounting_prepare',[id,owner,realm,JSON.stringify(payload)]),
    dispatch:(id,owner)=>rpc('gala_accounting_dispatch',[id,owner]),
    finish:(id,owner,receipt)=>rpc('gala_accounting_finish',[id,owner,receipt]),
    review:(id,owner,code)=>rpc('gala_accounting_review',[id,owner,code]),
  };
  const receipts=[];let posts=0;
  const gateway={realmId:'123',find:async doc=>receipts.filter(r=>r.DocNumber===doc),create:async payload=>{
    posts++;const receipt={...payload,Id:'99',TotalAmt:payload.Line[0].Amount};receipts.push(receipt);return receipt;
  }};
  return {...ctx,order,rpc,accounting:store,gateway,receipts,get posts(){return posts;},payload:()=>Promise.resolve(receiptFor(order,mapping,paymentTime)),
    job:async()=>(await ctx.db.query('select * from gala_accounting_outbox where order_id=$1',[order.id])).rows[0]};
}
test('receipt uses gross payment, one Symphony Ball line, Chicago payment date and explicit clearing account',()=>{
  const order={...priceRequest(input()),id:randomUUID(),status:'paid',payment_intent_id:'pi_test',stripe_session_id:'cs_test',currency:'usd'};
  const payload=receiptFor(order,mapping,paymentTime);
  assert.equal(payload.TxnDate,'2026-10-01');assert.equal(payload.Line.length,1);assert.equal(payload.Line[0].Amount,4375);
  assert.equal(payload.Line[0].Description,'Symphony Ball');assert.equal(payload.DepositToAccountRef.value,'40');
  assert.equal(payload.DocNumber.length,21);assert.equal(JSON.stringify(payload).includes('test@example.com'),false);
  for(const status of ['reserved','awaiting_payment','expired']) assert.throws(()=>receiptFor({...order,status},mapping,paymentTime));
  assert.throws(()=>receiptFor(order,{...mapping,itemId:''},paymentTime));
});
test('accounting worker posts once under repeated and concurrent calls',async t=>{
  const c=await setup(t);
  await Promise.all([syncReceipt(c.accounting,c.gateway,c.order.id,randomUUID(),c.payload),syncReceipt(c.accounting,c.gateway,c.order.id,randomUUID(),c.payload)]);
  await syncReceipt(c.accounting,c.gateway,c.order.id,randomUUID(),c.payload);
  assert.equal(c.posts,1);assert.equal((await c.job()).status,'synced');assert.equal((await c.job()).receipt_id,'99');
});
test('lost provider response recovers by lookup without posting or charging again',async t=>{
  const c=await setup(t);const create=c.gateway.create;c.gateway.create=async p=>{await create(p);throw new Error('lost response');};
  assert.equal(await syncReceipt(c.accounting,c.gateway,c.order.id,randomUUID(),c.payload),'review');
  assert.equal(await syncReceipt(c.accounting,c.gateway,c.order.id,randomUUID(),c.payload),'synced');assert.equal(c.posts,1);
});
test('uncertain dispatch with no receipt never sends a second create',async t=>{
  const c=await setup(t);let calls=0;c.gateway.create=async()=>{calls++;throw new Error('timeout');};
  await syncReceipt(c.accounting,c.gateway,c.order.id,randomUUID(),c.payload);
  await syncReceipt(c.accounting,c.gateway,c.order.id,randomUUID(),c.payload);
  assert.equal(calls,1);assert.equal((await c.job()).status,'review');assert.equal((await c.store.get(c.order.id)).status,'paid');
});
test('database-save failure after success recovers the same receipt',async t=>{
  const c=await setup(t);const finish=c.accounting.finish;c.accounting.finish=async()=>{throw new Error('database unavailable');};
  await syncReceipt(c.accounting,c.gateway,c.order.id,randomUUID(),c.payload);c.accounting.finish=finish;
  assert.equal(await syncReceipt(c.accounting,c.gateway,c.order.id,randomUUID(),c.payload),'synced');assert.equal(c.posts,1);
});
test('receipt conflicts, taxes and wrong references require review',async t=>{
  const c=await setup(t);const payload=await c.payload();const good={...payload,Id:'99',TotalAmt:4375};
  assert.equal(verifyReceipt(good,payload),'99');
  for(const patch of [{TotalAmt:1},{CurrencyRef:{value:'EUR'}},{CustomerRef:{value:'11'}},{DepositToAccountRef:{value:'41'}},{PrivateNote:'another sale'},{TxnTaxDetail:{TotalTax:1}}])
    assert.throws(()=>verifyReceipt({...good,...patch},payload));
  c.receipts.push({...good,PrivateNote:'another sale'});
  assert.equal(await syncReceipt(c.accounting,c.gateway,c.order.id,randomUUID(),c.payload),'review');assert.equal(c.posts,0);
});
test('durable payload cannot change company; expired workers cannot dispatch',async t=>{
  const c=await setup(t),owner=randomUUID();await c.accounting.claim(c.order.id,owner);
  const payload=await c.payload();await c.accounting.prepare(c.order.id,owner,'123',payload);
  await assert.rejects(c.accounting.prepare(c.order.id,owner,'456',payload));
  await c.db.query("update gala_accounting_outbox set lease_until=now()-interval '1 second' where order_id=$1",[c.order.id]);
  await assert.rejects(c.accounting.dispatch(c.order.id,owner));
  c.gateway.realmId='456';assert.equal(await syncReceipt(c.accounting,c.gateway,c.order.id,randomUUID(),c.payload),'review');assert.equal(c.posts,0);
});
test('connection lease serializes token changes and browser roles cannot read credentials',async t=>{
  const c=await setup(t),owner=randomUUID();assert.equal(await c.rpc('gala_qb_lock',[owner]),true);
  assert.equal(await c.rpc('gala_qb_lock',[randomUUID()]),false);
  await assert.rejects(c.rpc('gala_qb_save',[randomUUID(),'not-a-token']));
  for(const role of ['anon','authenticated']) {
    await c.db.exec(`set role ${role}`);await assert.rejects(c.db.query('select * from gala_qb_connection'));
    await assert.rejects(c.rpc('gala_accounting_claim',[c.order.id,randomUUID()]));await c.db.exec('reset role');
  }
});
test('encrypted sandbox tokens reject tampering, another key and another company',()=>{
  const key='a'.repeat(64),token={realmId:'123',accessToken:'secret-access',refreshToken:'secret-refresh',expiresAt:123,refreshExpiresAt:456};
  const sealed=sealTokens(token,key);assert.ok(!sealed.includes('secret'));assert.deepEqual(openTokens(sealed,key,'123'),token);
  assert.throws(()=>openTokens(sealed,'b'.repeat(64),'123'));assert.throws(()=>openTokens(sealed,key,'456'));
  assert.throws(()=>openTokens((sealed[0]==='a'?'b':'a')+sealed.slice(1),key,'123'));
});
test('sandbox config rejects production and cannot use existing membership credentials',()=>{
  const env={NODE_ENV:'development',GALA_BACKEND_ENABLED:'true',GALA_STRIPE_SECRET_KEY:'sk_test_fake',GALA_STRIPE_WEBHOOK_SECRET:'whsec_fake',GALA_SUPABASE_URL:'https://rhjwjfyjjdsfahlegqvd.supabase.co',GALA_SUPABASE_SECRET_KEY:'sb_secret_fake',GALA_DEVELOPMENT_TOKEN:'a'.repeat(64),GALA_QB_ENVIRONMENT:'sandbox',GALA_QB_CLIENT_ID:'sandbox',GALA_QB_CLIENT_SECRET:'fake',GALA_QB_REALM_ID:'123',GALA_QB_ENCRYPTION_KEY:'b'.repeat(64)};
  assert.equal(readQbConfig(env).realmId,'123');
  for(const patch of [{NODE_ENV:'production'},{VERCEL_ENV:'preview'},{GALA_QB_ENVIRONMENT:'production'},{GALA_QB_CLIENT_ID:'',QUICKBOOKS_CLIENT_ID:'live'},{GALA_QB_REALM_ID:'not-a-company'}]) assert.throws(()=>readQbConfig({...env,...patch}));
});
test('QuickBooks adapter only calls sandbox accounting and never sends invoices or charges',async()=>{
  const calls=[];const client=new SandboxQuickBooks('123','fake-token',async(url,options)=>{
    calls.push({url,options});
    const data=url.includes('/companyinfo/')?{CompanyInfo:{Country:'US'}}:url.endsWith('/preferences')?{Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}}}}:
      url.includes('/item/')?{Item:{Active:true,Type:'Service',IncomeAccountRef:{value:'30'}}}:
      url.endsWith('/account/30')?{Account:{Active:true,AccountType:'Income',Name:'Symphony Ball'}}:
      url.endsWith('/account/40')?{Account:{Active:true,AccountType:'Other Current Asset'}}:
      url.includes('/customer/')?{Customer:{Active:true}}:url.includes('/query?')?{QueryResponse:{}}:{SalesReceipt:{Id:'99'}};
    return Response.json(data);
  });
  const order={...priceRequest(input()),id:randomUUID(),status:'paid',payment_intent_id:'pi_test',stripe_session_id:'cs_test',currency:'usd'};
  const payload=receiptFor(order,mapping,paymentTime);await assert.rejects(client.create(payload,order.id));
  await client.verifyMapping(mapping);await client.find(payload.DocNumber);await client.create(payload,order.id);
  assert.equal(calls.length,8);assert.ok(calls.every(c=>c.url.startsWith('https://sandbox-quickbooks.api.intuit.com/v3/company/123/')));
  assert.ok(calls[7].url.includes('/salesreceipt?requestid='+order.id));assert.equal(calls[7].options.redirect,'error');
  assert.deepEqual(JSON.parse(calls[7].options.body),payload);assert.equal(calls.some(c=>/invoice|\/send|payments\.api/.test(c.url)),false);
  await assert.rejects(client.create({...payload,CustomerRef:{value:'999'}},order.id));assert.equal(calls.length,8);
});
