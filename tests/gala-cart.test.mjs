import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { testDatabase } from './helpers/gala-database.mjs';
import { priceRequest, CartUnavailable } from '../lib/gala/backend/domain.ts';
import { SupabaseOrderStore } from '../lib/gala/backend/store.ts';
import { sessionParameters, startCheckout, reconcileSession } from '../lib/gala/backend/checkout.ts';
import { CART_KEY, emptyCart, readCart, addToCart, cartCheckout, cartTotal } from '../lib/gala/cart.ts';
import { CHECKOUT_REFERENCE_KEY, saveCart, readShopping, finishPaidCart, clearShoppingDetails } from '../lib/gala/cart-storage.ts';
import { FLYER_ATTEMPT_KEY, readAttempt } from '../lib/gala/checkout-attempt.ts';

const contact = {name:'Fictional Cart Buyer',email:'cart@example.com',phone:'4325550123'};
const table = (product='silver', extraSeats=0) => ({product,quantity:1,extraSeats});
const gift = {student:'Fictional Student',grade:'12',roses:2,cookies:1};
const request = (purchases=[table(),table('student-date')],gifts=[gift]) => ({kind:'cart',requestId:randomUUID(),contact,allSalesFinal:true,purchases,gifts});
function memoryStorage() {
  const values=new Map();return { getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key) };
}
async function setup(t, beforeMigration) {
  const {db,store}=await testDatabase();t.after(()=>db.close());
  const folder=new URL('../supabase/gala-development/',import.meta.url);
  for(const name of (await readdir(folder)).filter(n=>/^0\d\d_.*\.sql$/.test(n)&&!n.startsWith('001_')).sort()) {
    if(name.startsWith('011_')&&beforeMigration) await beforeMigration(db,store);
    await db.exec(await readFile(new URL(name,folder),'utf8'));
  }
  const rpc=async(name,args=[])=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;
  const reserve=async(input=request())=>{await store.reserve(priceRequest(input));return input.requestId;};
  const settle=async(id,state='paid')=>store.apply(id,'cs_test_'+id,state,state==='paid'?'pi_'+id:null,'evt_'+state+'_'+id);
  return {db,store,rpc,reserve,settle};
}

test('mixed cart prices come from the server; Stripe item totals and restored request match exactly',()=>{
  const input=request([table('silver',2),table('student-date'),{product:'couples',quantity:2,extraSeats:0}]);
  const q=priceRequest(input);assert.equal(q.amount,323000);assert.equal(q.tier,null);
  const lines=sessionParameters({id:input.requestId,...q,created_at:new Date().toISOString()},'http://localhost:3000').line_items;
  assert.equal(lines.length,4);assert.equal(lines.reduce((sum,l)=>sum+l.price_data.unit_amount*l.quantity,0),q.amount);
  assert.deepEqual(priceRequest(readAttempt(JSON.stringify(input))),q);
  for(const bad of [{...input,amount:1},request([],[]),request(Array(11).fill(table())),request([],[{...gift,roses:-1}]),
    {...input,allSalesFinal:false},request([{...table(),quantity:2}]),request([{...table('student-date'),extraSeats:1}])]) assert.throws(()=>priceRequest(bad));
});

test('same-tab draft survives navigation, allows incomplete contact edits, and blocks edits while a payment is unresolved',()=>{
  const storage=memoryStorage();let cart=emptyCart();cart=addToCart(cart,{kind:'tables',purchase:table()});
  cart=addToCart(cart,{kind:'tables',purchase:table('student-date')});cart=addToCart(cart,{kind:'gifts',gifts:[gift]});
  cart.contact={...contact,name:''};saveCart(storage,cart);
  assert.deepEqual(readShopping(storage).cart,cart);assert.throws(()=>cartCheckout(cart,randomUUID()));
  cart.contact=contact;saveCart(storage,cart);assert.equal(cartTotal(readCart(storage.getItem(CART_KEY))),213000);
  const payload=cartCheckout(cart,randomUUID());storage.setItem(FLYER_ATTEMPT_KEY,JSON.stringify(payload));
  assert.equal(readShopping(storage).reference,payload.requestId);assert.throws(()=>saveCart(storage,emptyCart()));
  assert.deepEqual(readShopping(memoryStorage()).cart,emptyCart());
  for(const raw of ['broken','{}']) assert.throws(()=>readCart(raw));
});

test('payment confirmation only clears its matching draft; sign-out clears personal details but keeps an unresolved reference',()=>{
  const storage=memoryStorage(),payload=request();saveCart(storage,{purchases:payload.purchases,gifts:payload.gifts,contact});
  storage.setItem(FLYER_ATTEMPT_KEY,JSON.stringify(payload));finishPaidCart(storage,randomUUID());
  assert.ok(storage.getItem(CART_KEY));clearShoppingDetails(storage);
  assert.equal(storage.getItem(CART_KEY),null);assert.equal(storage.getItem(FLYER_ATTEMPT_KEY),null);
  assert.equal(storage.getItem(CHECKOUT_REFERENCE_KEY),payload.requestId);
  assert.throws(()=>saveCart(storage,emptyCart()));
  storage.removeItem(CHECKOUT_REFERENCE_KEY);saveCart(storage,{purchases:payload.purchases,gifts:payload.gifts,contact});
  storage.setItem(FLYER_ATTEMPT_KEY,JSON.stringify(payload));finishPaidCart(storage,payload.requestId);
  assert.deepEqual(readShopping(storage),{cart:emptyCart(),reference:payload.requestId});
});

test('migration preserves old payments, table assignment numbers, revisions, gift state and audit records',async t=>{
  const oldTable=randomUUID(),oldGift=randomUUID();let before;
  const {db,rpc,reserve}=await setup(t,async(db,store)=>{
    for(const [id,details] of [[oldTable,{kind:'tables',purchase:table()}],[oldGift,{kind:'gifts',gifts:[gift]}]]) {
      await store.reserve(priceRequest({requestId:id,contact,allSalesFinal:true,...details}));
      await store.apply(id,'cs_test_'+id,'paid','pi_'+id,'evt_'+id);
    }
    await db.query('select gala_assign_table($1,17,0)',[oldTable]);
    await db.query("select gala_set_gift_status($1,0,'prepared',0,'')",[oldGift]);
    before=(await db.query('select * from gala_orders order by id')).rows;
  });
  assert.deepEqual((await db.query('select * from gala_orders order by id')).rows,before);
  assert.equal((await rpc('gala_assignment_list'))[0].table_number,17);
  assert.equal((await rpc('gala_gift_list'))[0].status,'prepared');
  await rpc('gala_assign_table',[oldTable,18,1]);
  assert.equal((await db.query('select * from gala_assignment_events')).rows.length,2);
  const counts=await rpc('gala_inventory_counts');assert.equal(counts.find(t=>t.tier==='silver').paid,1);
  await reserve();assert.equal((await rpc('gala_inventory_counts')).find(t=>t.tier==='silver').held,1);
});

test('mixed and legacy buyers share inventory; oversize carts roll back every tier and retries reserve once',async t=>{
  const {db,store,rpc,reserve,settle}=await setup(t);
  await db.exec("update gala_inventory set capacity=1 where tier in ('silver','gold')");
  const first=request([table('gold'),table('silver')]);await reserve(first);await reserve(first);
  assert.equal((await db.query('select * from gala_order_tables')).rows.length,2);
  await assert.rejects(reserve({...first,contact:{...contact,name:'Changed'}}));
  await assert.rejects(reserve({requestId:randomUUID(),kind:'tables',contact,allSalesFinal:true,purchase:table()}));
  await assert.rejects(reserve(request([table('platinum'),table('silver')])));
  assert.equal((await rpc('gala_inventory_counts')).find(t=>t.tier==='platinum').held,0);
  assert.equal((await db.query('select * from gala_orders')).rows.length,1);
  await db.query("update gala_orders set created_at=now()-interval '2 hours' where id=$1",[first.requestId]);
  await assert.rejects(reserve()); // elapsed time alone does not free stock
  await settle(first.requestId,'expired');
  assert.equal((await rpc('gala_inventory_counts')).find(t=>t.tier==='gold').available,1);
  assert.equal((await db.query('select * from gala_accounting_outbox')).rows.length,0);
  const winners=await Promise.allSettled(Array.from({length:12},()=>reserve(request([table()]))));
  assert.equal(winners.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await rpc('gala_inventory_counts')).find(t=>t.tier==='silver').held,1);
  await assert.rejects(startCheckout(store,{},first,'http://localhost:3000'));
});

test('one mixed payment fulfills each table and student independently without an accounting job',async t=>{
  const {db,rpc,reserve,settle}=await setup(t);
  const id=await reserve(request([table(),table('student-date'),table('gold',2)],[gift,{...gift,grade:'9',roses:0,cookies:2}]));
  assert.deepEqual(await rpc('gala_assignment_list'),[]);assert.deepEqual(await rpc('gala_gift_list'),[]);
  await assert.rejects(rpc('gala_assign_table_line',[id,20,0,0]));
  await assert.rejects(rpc('gala_set_gift_status',[id,0,'prepared',0,'']));
  await settle(id);await settle(id);
  assert.equal((await db.query('select * from gala_accounting_outbox')).rows.length,0);
  const assignments=await rpc('gala_assignment_list');assert.deepEqual(assignments.map(a=>[a.line_index,a.seats]),[[0,8],[2,10]]);
  await rpc('gala_assign_table_line',[id,20,0,0]);await rpc('gala_assign_table_line',[id,21,0,2]);
  await assert.rejects(rpc('gala_assign_table_line',[id,20,1,2])); // unique number even within one cart
  await assert.rejects(rpc('gala_assign_table_line',[id,22,0,1])); // ticket is not a table
  await assert.rejects(rpc('gala_assign_table_line',[id,22,0,0])); // stale revision
  await rpc('gala_set_gift_status',[id,1,'prepared',0,'']);
  const gifts=await rpc('gala_gift_list');assert.equal(gifts.length,2);assert.deepEqual(gifts.map(g=>g.status),['pending','prepared']);
  assert.equal((await rpc('gala_inventory_counts')).find(t=>t.tier==='gold').paid,1);
});

test('new inventory and table RPCs stay private; staff cart assignment records the authorized actor',async t=>{
  const {db,rpc,reserve,settle}=await setup(t);const id=await reserve(request([table(),table('gold')]));await settle(id);
  for(const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    for(const sql of ['select * from gala_order_tables','select gala_inventory_counts()',`select gala_assign_table_line('${id}',30,0,1)`]) await assert.rejects(db.query(sql));
    await db.exec('reset role');
  }
  const user=randomUUID(),session='a'.repeat(64);
  await db.query('insert into gala_staff(user_id,enabled) values($1,true)',[user]);
  await rpc('gala_create_staff_session',[user,session,600]);
  await rpc('gala_staff_mutation',[session,'gala_assign_table',{p_order:id,p_number:30,p_revision:0,p_line:1}]);
  const event=(await db.query('select * from gala_assignment_events')).rows[0];assert.equal(event.actor,user);assert.equal(event.line_index,1);
  await db.query('update gala_staff set enabled=false where user_id=$1',[user]);
  await assert.rejects(rpc('gala_staff_mutation',[session,'gala_assign_table',{p_order:id,p_number:31,p_revision:1,p_line:1}]));
});

test('an interrupted mixed checkout reuses its itemized Stripe payload and keeps every tier held until verified expiry',async t=>{
  const {db,store,rpc}=await setup(t);const input=request([table('gold'),table('silver')]);let session,firstParams,key,calls=0;
  const stripe={checkout:{sessions:{
    create:async(params,options)=>{
      calls++;if(session){assert.deepEqual(params,firstParams);assert.equal(options.idempotencyKey,key);return session;}
      firstParams=params;key=options.idempotencyKey;
      session={id:'cs_test_'+randomUUID(),mode:'payment',livemode:false,status:'open',payment_status:'unpaid',currency:'usd',
        amount_total:params.line_items.reduce((n,l)=>n+l.price_data.unit_amount*l.quantity,0),metadata:params.metadata,
        client_reference_id:params.client_reference_id,url:'https://checkout.stripe.com/test',payment_intent:null};
      throw new Error('Response lost after Stripe created the session');
    },retrieve:async()=>session,
  }},paymentIntents:{retrieve:async()=>{throw new Error('No payment exists');}}};
  await assert.rejects(startCheckout(store,stripe,input,'http://localhost:3000'));
  assert.equal((await rpc('gala_inventory_counts')).reduce((n,t)=>n+t.held,0),2);
  const resumed=await startCheckout(store,stripe,readAttempt(JSON.stringify(input)),'http://localhost:3000');
  assert.equal(resumed.orderId,input.requestId);assert.equal(calls,2);assert.equal((await db.query('select * from gala_orders')).rows.length,1);
  assert.equal(await reconcileSession(store,stripe,session.id,'check-open'),'pending');
  session={...session,status:'expired'};
  await reconcileSession(store,stripe,session.id,'expired');await reconcileSession(store,stripe,session.id,'expired');
  assert.equal((await rpc('gala_inventory_counts')).reduce((n,t)=>n+t.held,0),0);
  assert.equal((await db.query('select * from gala_accounting_outbox')).rows.length,0);
});

test('only a definite inventory rejection unlocks cart edits; transport and unknown database failures stay uncertain',async()=>{
  const quote=priceRequest(request());
  const adapter=body=>new SupabaseOrderStore('https://example.supabase.co','sb_secret_test',async()=>new Response(JSON.stringify(body),{status:400,headers:{'Content-Type':'application/json'}}));
  await assert.rejects(adapter({code:'P0001',message:'Table tier sold out or reserved'}).reserve(quote),CartUnavailable);
  for(const body of [{code:'P0001',message:'Request ID reused with different details'},{code:'57014',message:'Database timed out'}]) {
    await assert.rejects(adapter(body).reserve(quote),e=>!(e instanceof CartUnavailable));
  }
});
