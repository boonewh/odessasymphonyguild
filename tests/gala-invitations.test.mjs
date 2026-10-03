import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {testDatabase} from './helpers/gala-database.mjs';
import {invitationRequest,invitationUpdate,readInvitationAttempt,duplicateInvitations,filterInvitations,invitationsCsv,invitationKey} from '../lib/gala/invitations.ts';
const recipient={name:'Fictional Guest',address:'123 Test Lane',address2:'Suite 2',city:'Odessa',state:'TX',zip:'79761'};
const input=()=>({requestId:randomUUID(),contact:{name:'Test Requester',email:'invites-test@example.com',phone:'4325550100'},recipients:[recipient,{...recipient,name:'Second Guest'}]});
async function setup(t){const {db}=await testDatabase();t.after(()=>db.close());
  await db.exec(await readFile(new URL('../supabase/gala-development/005_gala_invitations.sql',import.meta.url),'utf8'));
  const create=async payload=>(await db.query('select gala_request_invitations($1) as id',[JSON.stringify(payload)])).rows[0].id;
  const list=async()=>(await db.query('select gala_invitation_list() as rows')).rows[0].rows;
  const update=async(id,index,status,revision=0,reason='')=>(await db.query('select gala_set_invitation_status($1,$2,$3,$4,$5)',[id,index,status,revision,reason]));
  return {db,create,list,update};
}
test('invitation retry persists one request and separate recipients without creating a sale',async t=>{
  const {db,create,list}=await setup(t),request=input();
  const before=(await db.query('select * from gala_inventory order by tier')).rows;
  assert.deepEqual(await Promise.all([create(request),create(request)]),[request.requestId,request.requestId]);
  assert.equal((await list()).length,2);
  await assert.rejects(create({...request,recipients:[recipient]}));
  assert.equal((await db.query('select count(*)::int as n from gala_invitation_requests')).rows[0].n,1);
  for(const table of ['gala_orders','gala_accounting_outbox'])assert.equal((await db.query('select count(*)::int as n from '+table)).rows[0].n,0);
  assert.deepEqual((await db.query('select * from gala_inventory order by tier')).rows,before);
  assert.ok((await list()).every(r=>r.status==='requested'&&r.revision===0));
});
test('mailing transitions are per recipient, audited, revision protected and require preparation/correction reasons',async t=>{
  const {db,create,list,update}=await setup(t),request=input();await create(request);
  const original=(await db.query('select * from gala_invitation_requests')).rows;
  await assert.rejects(update(request.requestId,0,'mailed'));
  await assert.rejects(update(request.requestId,2,'prepared'));
  const race=await Promise.allSettled([update(request.requestId,0,'prepared'),update(request.requestId,0,'prepared')]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  await update(request.requestId,0,'prepared',1); // no-op
  await assert.rejects(update(request.requestId,0,'mailed',0));
  await update(request.requestId,0,'mailed',1);
  await assert.rejects(update(request.requestId,0,'requested',2,'  '));
  await update(request.requestId,0,'requested',2,'Wrong envelope marked mailed');
  const events=(await db.query('select previous_status,status,revision,reason from gala_invitation_events order by revision')).rows;
  assert.deepEqual(events.map(r=>[r.previous_status,r.status,r.revision]),[['requested','prepared',1],['prepared','mailed',2],['mailed','requested',3]]);
  assert.equal(events[2].reason,'Wrong envelope marked mailed');
  assert.equal((await list())[1].revision,0);
  assert.deepEqual((await db.query('select * from gala_invitation_requests')).rows,original);
});
test('invitation data and functions deny browser roles but permit server service role',async t=>{
  const {db,create}=await setup(t),request=input();await create(request);
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);
    for(const sql of ['select * from gala_invitation_requests','select * from gala_invitation_recipients','select * from gala_invitation_events','select gala_invitation_list()',`select gala_request_invitations('{}')`,`select gala_set_invitation_status('${request.requestId}',0,'prepared',0,'')`])await assert.rejects(db.query(sql));
    await db.exec('reset role');}
  await db.exec('set role service_role');await create(input());
  await db.query('select gala_set_invitation_status($1,0,$2,0,$3)',[request.requestId,'prepared','']);
  assert.equal((await db.query('select gala_invitation_list() as rows')).rows[0].rows.length,4);
});
test('request validation and saved-attempt parsing preserve retry identity and reject malformed submissions',()=>{
  const payload=input();assert.deepEqual(readInvitationAttempt(JSON.stringify(payload)),payload);assert.equal(readInvitationAttempt(null),null);
  for(const value of ['broken','{}'])assert.throws(()=>readInvitationAttempt(value));
  for(const patch of [{requestId:'invalid'},{recipients:[]},{recipients:Array(21).fill(recipient)},{recipients:[{...recipient,zip:'oops'}]},{status:'mailed'},{amount:0}])
    assert.equal(invitationRequest.safeParse({...payload,...patch}).success,false);
  for(const patch of [{status:'paid'},{recipientIndex:20},{revision:-1},{reason:'x'.repeat(301)},{recipient:{...recipient}}])
    assert.equal(invitationUpdate.safeParse({requestId:payload.requestId,recipientIndex:0,status:'prepared',revision:0,...patch}).success,false);
});
test('duplicate review preserves recipients, respects apartment/name differences and uses the full list before filtering',()=>{
  const row={request_id:randomUUID(),recipient_index:0,recipient,contact:input().contact,status:'mailed',revision:2};
  const same={...row,request_id:randomUUID(),recipient:{...recipient,name:'  FICTIONAL   GUEST  '},status:'requested'};
  const apartment={...same,recipient_index:1,recipient:{...recipient,address2:'Suite 3'}};
  const name={...same,recipient_index:2,recipient:{...recipient,name:'Other Guest'}};
  const rows=[row,same,apartment,name],duplicates=duplicateInvitations(rows);
  assert.deepEqual([...duplicates].sort(),[invitationKey(row),invitationKey(same)].sort());
  assert.equal(rows.length,4);const filtered=filterInvitations(rows,'requested');assert.equal(filtered.length,3);
  assert.match(invitationsCsv(filtered,duplicates),/REVIEW/);
});
test('mailing CSV keeps every row, address line and leading ZIP zero with formula-safe cells',()=>{
  const row={request_id:randomUUID(),recipient_index:0,recipient:{...recipient,name:' =BAD("x")',zip:'01234'},contact:input().contact,status:'requested',revision:0};
  const rows=Array.from({length:125},()=>({...row,request_id:randomUUID()})),csv=invitationsCsv(rows,new Set());
  assert.equal(csv.split('\r\n').length,127);assert.ok(csv.includes('"\' =BAD(""x"")"'));assert.ok(csv.includes('"01234"'));assert.match(csv,/Suite 2/);
});
