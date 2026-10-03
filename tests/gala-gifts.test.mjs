import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {testDatabase} from './helpers/gala-database.mjs';
import {priceRequest} from '../lib/gala/backend/domain.ts';
import {filterGifts,giftTotals,giftsCsv,giftUpdate} from '../lib/gala/gift-fulfillment.ts';

async function setup(t){
  const {db,store}=await testDatabase();t.after(()=>db.close());
  await db.exec(await readFile(new URL('../supabase/gala-development/004_gala_gifts.sql',import.meta.url),'utf8'));
  const list=async()=>(await db.query('select gala_gift_list() as rows')).rows[0].rows;
  const update=async(id,index,status,revision=0,reason='')=>(await db.query('select gala_set_gift_status($1,$2,$3,$4,$5) as row',[id,index,status,revision,reason])).rows[0].row;
  async function order(state='paid',kind='gifts'){
    const id=randomUUID();const input={requestId:id,allSalesFinal:true,kind,contact:{name:'Buyer',email:'gift-test@example.com',phone:'4325550100'},
      ...(kind==='gifts'?{gifts:[{student:'Same Name',grade:'9',roses:2,cookies:1},{student:'Same Name',grade:'12',roses:0,cookies:3}]}:{purchase:{product:'gold',quantity:1,extraSeats:0}})};
    await store.reserve(priceRequest(input));await store.bind(id,'cs_test_'+id);
    if(state==='paid'||state==='expired')await store.apply(id,'cs_test_'+id,state,state==='paid'?'pi_test_'+id:null,'evt_'+id);
    return id;
  }
  return {db,store,list,update,order};
}

test('fulfillment includes only paid gifts and keeps same-name recipients and orders separate',async t=>{
  const {order,list,update}=await setup(t);const a=await order(),b=await order();
  const pending=await order('awaiting_payment'),expired=await order('expired'),table=await order('paid','tables');
  for(const id of [pending,expired,table,randomUUID()])await assert.rejects(update(id,0,'prepared'));
  const rows=await list();assert.equal(rows.length,4);assert.equal(new Set(rows.map(r=>r.order_id+':'+r.recipient_index)).size,4);
  assert.deepEqual(giftTotals(rows),{recipients:4,roses:4,cookies:8});
  await update(a,0,'prepared');
  const next=await list();assert.equal(next.filter(r=>r.status==='prepared').length,1);
  assert.ok(next.filter(r=>r.order_id===b).every(r=>r.status==='pending'));
  for(const index of [-1,2,20])await assert.rejects(update(a,index,'prepared'));
});

test('ordered transitions, revision conflicts and reasoned corrections preserve payment records and audit each change',async t=>{
  const {db,order,list,update}=await setup(t);const id=await order();
  const before=(await db.query('select * from gala_orders')).rows;
  const accounting=(await db.query('select * from gala_accounting_outbox')).rows;
  await assert.rejects(update(id,0,'delivered'));
  const race=await Promise.allSettled([update(id,0,'prepared'),update(id,0,'prepared')]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  await update(id,0,'prepared',1); // no-op
  await assert.rejects(update(id,0,'delivered',0));
  await update(id,0,'delivered',1);
  await assert.rejects(update(id,0,'prepared',2));
  await update(id,0,'pending',2,'Wrong bundle marked handed out');
  const events=(await db.query('select previous_status,status,revision,reason from gala_gift_events order by revision')).rows;
  assert.deepEqual(events.map(r=>[r.previous_status,r.status,r.revision]),[['pending','prepared',1],['prepared','delivered',2],['delivered','pending',3]]);
  assert.equal(events[2].reason,'Wrong bundle marked handed out');
  assert.deepEqual((await db.query('select * from gala_orders')).rows,before);
  assert.deepEqual((await db.query('select * from gala_accounting_outbox')).rows,accounting);
  assert.equal((await list()).find(r=>r.recipient_index===1).revision,0);
});

test('gift details, events and RPCs are unavailable to browser roles',async t=>{
  const {db,order}=await setup(t);const id=await order();
  for(const role of ['anon','authenticated']){
    await db.exec('set role '+role);
    for(const sql of ['select * from gala_gift_fulfillment','select * from gala_gift_events','select gala_gift_list()',`select gala_set_gift_status('${id}',0,'prepared',0,'')`])await assert.rejects(db.query(sql));
    await db.exec('reset role');
  }
  await db.exec('set role service_role');await db.query('select gala_set_gift_status($1,0,$2,0,$3)',[id,'prepared','']);
  assert.equal((await db.query('select gala_gift_list() as rows')).rows[0].rows.length,2);
});

test('gift exports preserve all lines, quantities and statuses with spreadsheet-safe recipient text',()=>{
  const row={order_id:randomUUID(),recipient_index:0,buyer:{name:'Buyer',email:'gift-test@example.com',phone:'+14325550100'},student:' =BAD("x")',grade:'9',roses:2,cookies:3,status:'prepared',revision:1};
  const rows=Array.from({length:125},(_,i)=>({...row,order_id:randomUUID(),status:i%2?'pending':'prepared'}));
  assert.equal(filterGifts(rows,'prepared').length,63);assert.deepEqual(giftTotals(rows),{recipients:125,roses:250,cookies:375});
  const csv=giftsCsv(rows);assert.equal(csv.split('\r\n').length,127);assert.ok(csv.includes('"\' =BAD(""x"")"'));assert.ok(csv.includes('"\'+14325550100"'));
  for(const patch of [{recipientIndex:20},{recipientIndex:-1},{revision:1.5},{status:'paid'},{reason:'x'.repeat(301)},{roses:99}])assert.equal(giftUpdate.safeParse({orderId:row.order_id,recipientIndex:0,status:'prepared',revision:0,...patch}).success,false);
});
