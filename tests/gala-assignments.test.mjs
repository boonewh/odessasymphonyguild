import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { testDatabase } from './helpers/gala-database.mjs';
import { priceRequest } from '../lib/gala/backend/domain.ts';
import { assignmentRequest, assignmentsCsv, filterAssignments } from '../lib/gala/assignments.ts';

async function setup(t) {
  const {db,store}=await testDatabase(); t.after(()=>db.close());
  await db.exec(await readFile(new URL('../supabase/gala-development/003_gala_assignments.sql',import.meta.url),'utf8'));
  const assign=async(id,number,revision=0)=>(await db.query('select gala_assign_table($1,$2,$3) as result',[id,number,revision])).rows[0].result;
  const list=async()=>(await db.query('select gala_assignment_list() as result')).rows[0].result;
  async function order(product='gold',state='paid') {
    const id=randomUUID(); const gift=product==='gifts';
    const input={requestId:id,allSalesFinal:true,kind:gift?'gifts':'tables',contact:{name:'Test Buyer',email:'test@example.com',phone:'4325550100'},
      ...(gift?{gifts:[{student:'Test Student',grade:'9',roses:1,cookies:0}]}:{purchase:{product,quantity:1,extraSeats:['gold','silver','platinum'].includes(product)?2:0}})};
    await store.reserve(priceRequest(input)); await store.bind(id,'cs_test_'+id);
    if(state==='paid'||state==='expired') await store.apply(id,'cs_test_'+id,state,state==='paid'?'pi_test_'+id:null,'evt_'+id);
    return id;
  }
  return {db,store,assign,list,order};
}

test('only paid table purchases appear and can be assigned; payment and inventory remain unchanged',async t=>{
  const {db,order,assign,list}=await setup(t);
  const id=await order(); const otherIds=[];
  for(const [product,state] of [['silver','awaiting_payment'],['platinum','expired'],['couples','paid'],['student-date','paid'],['gifts','paid']]) otherIds.push(await order(product,state));
  const before=(await db.query('select * from gala_orders order by id')).rows;
  const accounting=(await db.query('select * from gala_accounting_outbox order by order_id')).rows;
  for(const other of [...otherIds,randomUUID()]) await assert.rejects(assign(other,7));
  assert.deepEqual((await list()).map(r=>[r.id,r.seats,r.table_number,r.revision]),[[id,10,null,0]]);
  await assign(id,7); assert.equal((await list())[0].table_number,7);
  assert.deepEqual((await db.query('select * from gala_orders order by id')).rows,before);
  assert.deepEqual((await db.query('select * from gala_accounting_outbox order by order_id')).rows,accounting);
});

test('duplicate numbers across tiers fail atomically; stale edits and retries cannot overwrite another change',async t=>{
  const {db,order,assign}=await setup(t); const a=await order('gold'), b=await order('silver');
  const race=await Promise.allSettled([assign(a,12),assign(b,12)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  const winner=race[0].status==='fulfilled'?a:b, loser=winner===a?b:a;
  await assign(loser,13);
  await assert.rejects(assign(loser,12,1));
  assert.equal((await db.query('select table_number from gala_table_assignments where order_id=$1',[loser])).rows[0].table_number,13);
  await assert.rejects(assign(winner,15,0));
  await assign(winner,14,1); await assign(winner,14,2); // No-op does not add audit rows.
  await assign(winner,null,2); await assign(loser,14,1);
  const events=(await db.query('select previous_number,table_number,revision from gala_assignment_events where order_id=$1 order by revision',[winner])).rows;
  assert.deepEqual(events,[{previous_number:null,table_number:12,revision:1},{previous_number:12,table_number:14,revision:2},{previous_number:14,table_number:null,revision:3}]);
  for(const n of [0,1000,-1]) await assert.rejects(assign(winner,n,3));
});

test('assignment tables and RPCs reject anonymous and browser roles',async t=>{
  const {db,order}=await setup(t); const id=await order();
  for(const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    for(const sql of ['select * from gala_table_assignments','select * from gala_assignment_events','select gala_assignment_list()',`select gala_assign_table('${id}',1,0)`]) await assert.rejects(db.query(sql));
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  await db.query('select gala_assign_table($1,1,0)',[id]);
  assert.equal((await db.query('select gala_assignment_list() as rows')).rows[0].rows.length,1);
});

test('export includes every matching row, seat counts and safe CSV text; request rejects invalid numbers',()=>{
  const row={id:randomUUID(),tier:'gold',buyer:{name:' =HYPERLINK("bad")',email:'test@example.com',phone:'+14325550100'},seats:10,table_number:null,revision:0};
  const rows=Array.from({length:125},(_,i)=>({...row,id:randomUUID(),table_number:i%2===0?i+1:null}));
  const csv=assignmentsCsv(rows);
  assert.equal(csv.split('\r\n').length,127);
  assert.ok(csv.includes('"\' =HYPERLINK(""bad"")"')); assert.ok(csv.includes('"\'+14325550100"'));
  assert.equal(filterAssignments(rows,'assigned').length,63); assert.equal(filterAssignments(rows,'unassigned').length,62);
  assert.equal(assignmentRequest.parse({orderId:row.id,tableNumber:null,revision:0}).tableNumber,null);
  for(const n of [0,1000,1.5,'1',NaN]) assert.equal(assignmentRequest.safeParse({orderId:row.id,tableNumber:n,revision:0}).success,false);
});
