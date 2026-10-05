import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {testDatabase} from './helpers/gala-database.mjs';
import {invitationRequest,invitationUpdate,invitationAddressUpdate,invitationDuplicateUpdate,invitationPatch,readInvitationAttempt,duplicateInvitations,filterInvitations,invitationsCsv,invitationKey} from '../lib/gala/invitations.ts';
import {invitationPrintBatch,invitationLabelsHtml,invitationPrintScript} from '../lib/gala/invitation-print.ts';
const recipient={name:'Fictional Guest',address:'123 Test Lane',address2:'Suite 2',city:'Odessa',state:'TX',zip:'79761'};
const input=()=>({requestId:randomUUID(),contact:{name:'Test Requester',email:'invites-test@example.com',phone:'4325550100'},recipients:[recipient,{...recipient,name:'Second Guest'}]});

test('label batches exclude suppressed and mailed entries and block unresolved matches across statuses',()=>{
  const row={request_id:randomUUID(),recipient_index:0,recipient,contact:input().contact,status:'requested',revision:0};
  const suppressed={...row,recipient_index:1,duplicate_request_id:row.request_id,duplicate_recipient_index:0};
  const mailed={...row,recipient_index:2,status:'mailed',recipient:{...recipient,name:'Already mailed'}};
  const rows=[row,suppressed,mailed],before=structuredClone(rows);
  assert.deepEqual(invitationPrintBatch(rows,'requested',0),[[row]]);
  assert.deepEqual(rows,before);
  for(const filter of ['all','mailed','suppressed','unknown'])assert.throws(()=>invitationPrintBatch(rows,filter,0));
  for(const skip of [-1,30,1.5,NaN])assert.throws(()=>invitationPrintBatch(rows,'requested',skip));
  assert.throws(()=>invitationPrintBatch(rows,'prepared',0),/No invitations/);
  const possible={...row,recipient_index:3,status:'prepared'};
  assert.throws(()=>invitationPrintBatch([...rows,possible],'requested',0),/Review possible duplicates/);
  assert.throws(()=>invitationPrintBatch([...rows,possible],'prepared',0),/Review possible duplicates/);
  const reviewed={...row,separate_from:[invitationKey(possible)]};
  assert.deepEqual(invitationPrintBatch([reviewed,possible],'prepared',0),[[possible]]);
});

test('label sheets preserve addresses and ZIPs, escape HTML and skip used positions only on the first sheet',()=>{
  const rows=Array.from({length:32},(_,i)=>({request_id:randomUUID(),recipient_index:0,recipient:{...recipient,name:`Guest ${i}`,zip:'01234-5678'},contact:input().contact,status:'requested',revision:0}));
  const pages=invitationPrintBatch(rows,'requested',29);
  assert.deepEqual(pages.map(p=>p.length),[30,30,1]);
  assert.equal(pages[0][29],rows[0]);assert.equal(pages[1][0],rows[1]);assert.equal(pages[2][0],rows[31]);
  rows[0].recipient.name='<script>alert("unsafe")</script>';
  const html=invitationLabelsHtml(rows,'requested',29);
  assert.ok(html.includes('&lt;script&gt;alert(&quot;unsafe&quot;)&lt;/script&gt;'));
  assert.ok(html.includes('01234-5678'));assert.ok(html.includes('Suite 2'));
  assert.ok(!html.includes(rows[0].contact.email));assert.ok(!html.includes(rows[0].contact.phone));
  assert.equal((html.match(/<script>/g)||[]).length,1);assert.ok(html.includes(`<script>${invitationPrintScript}</script>`));
  assert.equal((html.match(/Used label — left blank/g)||[]).length,29);
  assert.equal((html.match(/DEVELOPMENT ONLY — FICTIONAL ADDRESS/g)||[]).length,32);
});
async function setup(t){const {db}=await testDatabase();t.after(()=>db.close());
  await db.exec(await readFile(new URL('../supabase/gala-development/005_gala_invitations.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/gala-development/006_gala_invitation_addresses.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/gala-development/007_gala_invitation_duplicates.sql',import.meta.url),'utf8'));
  const create=async payload=>(await db.query('select gala_request_invitations($1) as id',[JSON.stringify(payload)])).rows[0].id;
  const list=async()=>(await db.query('select gala_invitation_list() as rows')).rows[0].rows;
  const update=async(id,index,status,revision=0,reason='')=>(await db.query('select gala_set_invitation_status($1,$2,$3,$4,$5)',[id,index,status,revision,reason]));
  const address=async(id,index,details,revision=0,reason='Requester corrected address')=>(await db.query(
    'select gala_set_invitation_address($1,$2,$3,$4,$5) as row',[id,index,JSON.stringify(details),revision,reason])).rows[0].row;
  const resolve=async(id,index,revision,decision,target=null,targetIndex=null,targetRevision=null,reason='Reviewed fictional duplicate')=>(await db.query(
    'select gala_resolve_invitation_duplicate($1,$2,$3,$4,$5,$6,$7,$8) as row',[id,index,revision,decision,target,targetIndex,targetRevision,reason])).rows[0].row;
  return {db,create,list,update,address,resolve};
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

test('address corrections preserve submission retries, other recipients and financial records, with complete audit details',async t=>{
  const {db,create,list,address}=await setup(t),request=input();await create(request);
  const original=(await db.query('select * from gala_invitation_requests')).rows;
  const financial=async()=> (await db.query(`select jsonb_build_object(
    'orders',(select jsonb_agg(o) from gala_orders o),
    'inventory',(select jsonb_agg(i order by tier) from gala_inventory i),
    'accounting',(select jsonb_agg(a) from gala_accounting_outbox a)) as snapshot`)).rows[0].snapshot;
  const before=await financial(),other=(await list())[1];
  const corrected={...recipient,name:'Corrected Guest',address:'456 New Lane',address2:'',zip:'01234-5678'};
  const saved=await address(request.requestId,0,corrected);
  assert.deepEqual(saved.recipient,corrected);assert.equal(saved.revision,1);assert.equal(saved.status,'requested');
  assert.equal(await create(request),request.requestId);
  assert.deepEqual((await list())[0].recipient,corrected);
  assert.deepEqual((await list())[1],other);
  assert.deepEqual((await db.query('select * from gala_invitation_requests')).rows,original);
  assert.deepEqual(await financial(),before);
  const event=(await db.query('select * from gala_invitation_events')).rows[0];
  assert.equal(event.kind,'address');assert.deepEqual(event.previous_recipient,recipient);assert.deepEqual(event.recipient,corrected);
  assert.equal(event.actor,'local-development-admin');assert.equal(event.reason,'Requester corrected address');assert.equal(event.revision,1);
  assert.equal(event.previous_status,'requested');assert.equal(event.status,'requested');
  await assert.rejects(create({...request,recipients:[corrected,request.recipients[1]]}));
});

test('prepared address edits require fresh preparation; unchanged addresses do not reset status or add events; mailed addresses are locked',async t=>{
  const {db,create,list,update,address}=await setup(t),request=input();await create(request);
  await update(request.requestId,0,'prepared');
  const unchanged=await address(request.requestId,0,{...recipient,address:'  '+recipient.address+'  '},1);
  assert.equal(unchanged.revision,1);assert.equal(unchanged.status,'prepared');
  assert.equal((await db.query('select count(*)::int as n from gala_invitation_events')).rows[0].n,1);
  const corrected={...recipient,address:'456 New Lane'};
  const saved=await address(request.requestId,0,corrected,1);
  assert.equal(saved.status,'requested');assert.equal(saved.revision,2);
  const event=(await db.query("select * from gala_invitation_events where kind='address'")).rows[0];
  assert.equal(event.previous_status,'prepared');assert.equal(event.status,'requested');
  await assert.rejects(update(request.requestId,0,'mailed',2));
  await update(request.requestId,0,'prepared',2);await update(request.requestId,0,'mailed',3);
  const before=await list();await assert.rejects(address(request.requestId,0,recipient,4));assert.deepEqual(await list(),before);
  await update(request.requestId,0,'requested',4,'Mailing status was recorded incorrectly');
  await address(request.requestId,0,recipient,5);
});

test('address and mailing edits share revision protection and failed corrections leave no partial audit or data changes',async t=>{
  const {db,create,list,update,address}=await setup(t),request=input();await create(request);
  const results=await Promise.allSettled([
    address(request.requestId,0,{...recipient,address:'456 New Lane'}),
    update(request.requestId,0,'prepared'),
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const before=await list();await assert.rejects(address(request.requestId,0,{...recipient,address:'789 Other Lane'},0));
  assert.deepEqual(await list(),before);
  assert.equal((await db.query('select count(*)::int as n from gala_invitation_events')).rows[0].n,1);
  await assert.rejects(address(request.requestId,19,recipient));
});

test('address changes validate at API and SQL boundaries and deny browser-role access',async t=>{
  const {db,create,address,list}=await setup(t),request=input();await create(request);
  const payload={action:'address',requestId:request.requestId,recipientIndex:0,recipient,revision:0,reason:'Corrected by requester'};
  assert.equal(invitationPatch.safeParse(payload).success,true);
  for(const patch of [{action:'unknown'},{revision:-1},{recipientIndex:20},{reason:'  '},{reason:'x'.repeat(301)},
    {recipient:{...recipient,zip:'123'}},{recipient:{...recipient,state:'Texas'}},{recipient:{...recipient,unexpected:'value'}},{status:'mailed'}])
    assert.equal(invitationAddressUpdate.safeParse({...payload,...patch}).success,false);
  const before=await list();
  for(const value of [null,[],{}, {...recipient,zip:'invalid'},{...recipient,name:''},{...recipient,address2:null},
    {...recipient,extra:'value'},{...recipient,city:'x'.repeat(101)}])await assert.rejects(address(request.requestId,0,value));
  for(const reason of ['', '  ', 'x'.repeat(301)])await assert.rejects(address(request.requestId,0,recipient,0,reason));
  assert.deepEqual(await list(),before);
  for(const role of ['anon','authenticated']){
    await db.exec('set role '+role);await assert.rejects(address(request.requestId,0,recipient));await db.exec('reset role');
  }
  await db.exec('set role service_role');
  await address(request.requestId,0,{...recipient,address:'456 New Lane'});
});

test('corrected addresses drive duplicate hints and mailing exports without changing original request details',async t=>{
  const {create,list,address}=await setup(t),request=input();await create(request);
  const second={...input(),recipients:[recipient]};await create(second);
  assert.equal(duplicateInvitations(await list()).size,2);
  await address(request.requestId,0,{...recipient,address:'456 New Lane',zip:'01234'});
  const rows=await list(),duplicates=duplicateInvitations(rows);
  assert.equal(duplicates.size,0);
  const csv=invitationsCsv(rows,duplicates);assert.match(csv,/456 New Lane/);assert.match(csv,/"01234"/);
  await create(request);
  assert.equal((await list()).find(r=>r.request_id===request.requestId&&r.recipient_index===0).recipient.address,'456 New Lane');
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

test('suppression is reversible, audited, excludes mailing exports, and preserves original requests and financial records',async t=>{
  const {db,create,list,resolve,update}=await setup(t),a=input(),b=input();await create(a);await create(b);
  const original=(await db.query('select * from gala_invitation_requests order by id')).rows;
  const stock=(await db.query('select * from gala_inventory order by tier')).rows;
  await update(b.requestId,0,'prepared');
  const suppressed=await resolve(b.requestId,0,1,'suppress',a.requestId,0,0);
  assert.equal(suppressed.status,'requested');assert.equal(suppressed.duplicate_request_id,a.requestId);
  let rows=await list();assert.equal(rows.length,4);assert.equal(filterInvitations(rows,'suppressed').length,1);
  assert.equal(filterInvitations(rows,'all').length,3);assert.equal(filterInvitations(rows,'requested').length,3);
  assert.equal(invitationsCsv(rows,new Set()).split('\r\n').length,5); // header + 3 rows + trailing newline
  const audits=(await db.query("select * from gala_invitation_events where kind='duplicate'")).rows;
  assert.equal(audits.length,1);assert.equal(audits[0].previous_status,'prepared');assert.equal(audits[0].status,'requested');
  assert.equal(audits[0].resolution_after.target_request_id,a.requestId);assert.equal(audits[0].reason,'Reviewed fictional duplicate');
  await resolve(b.requestId,0,2,'suppress',a.requestId,0,0); // no-op
  assert.equal((await db.query("select count(*)::int n from gala_invitation_events where kind='duplicate'")).rows[0].n,1);
  await create(b); // original submission cannot undo suppression
  assert.equal(filterInvitations(await list(),'suppressed').length,1);
  await resolve(b.requestId,0,2,'restore');rows=await list();assert.equal(filterInvitations(rows,'all').length,4);
  assert.equal(duplicateInvitations(rows).size,4);assert.equal(filterInvitations(rows,'suppressed').length,0);
  await resolve(b.requestId,0,3,'restore'); // no-op
  assert.deepEqual((await db.query('select * from gala_invitation_requests order by id')).rows,original);
  assert.deepEqual((await db.query('select * from gala_inventory order by tier')).rows,stock);
  for(const table of ['gala_orders','gala_accounting_outbox'])assert.equal((await db.query('select count(*)::int n from '+table)).rows[0].n,0);
});

test('suppressed entries cannot be mailed or edited, retained entries cannot form chains, and mailed sources cannot be suppressed',async t=>{
  const {create,list,resolve,update,address}=await setup(t),a=input(),b=input(),c=input();await create(a);await create(b);await create(c);
  await resolve(b.requestId,0,0,'suppress',a.requestId,0,0);
  await assert.rejects(update(b.requestId,0,'prepared',1));
  await assert.rejects(address(b.requestId,0,{...recipient,address:'999 New Lane'},1));
  await assert.rejects(address(a.requestId,0,{...recipient,address:'999 New Lane'},0));
  await assert.rejects(resolve(a.requestId,0,0,'suppress',c.requestId,0,0));
  await assert.rejects(resolve(c.requestId,0,0,'suppress',b.requestId,0,1));
  await assert.rejects(resolve(a.requestId,0,0,'suppress',a.requestId,0,0));
  await update(a.requestId,0,'prepared',0);await update(a.requestId,0,'mailed',1);
  await assert.rejects(resolve(a.requestId,0,2,'suppress',c.requestId,0,0));
  await resolve(c.requestId,0,0,'suppress',a.requestId,0,2); // keeping an already-mailed entry is valid
  assert.equal(filterInvitations(await list(),'suppressed').length,2);
});

test('keep-separate decisions are symmetric, pair-specific, invalidated by address edits and do not hide new matches',async t=>{
  const {create,list,resolve,address,db}=await setup(t),a={...input(),recipients:[recipient]},b={...input(),recipients:[recipient]};
  await create(a);await create(b);await resolve(a.requestId,0,0,'separate',b.requestId,0,0);
  let rows=await list();assert.equal(duplicateInvitations(rows).size,0);assert.equal(filterInvitations(rows,'all').length,2);
  assert.deepEqual(rows.find(r=>r.request_id===a.requestId).separate_from,[b.requestId+':0']);
  assert.deepEqual(rows.find(r=>r.request_id===b.requestId).separate_from,[a.requestId+':0']);
  await resolve(b.requestId,0,0,'separate',a.requestId,0,1); // reversed no-op
  assert.equal((await db.query('select count(*)::int n from gala_invitation_events')).rows[0].n,1);
  const c={...input(),recipients:[recipient]};await create(c);assert.equal(duplicateInvitations(await list()).size,3);
  await address(a.requestId,0,{...recipient,address:'999 New Lane'},1);
  await address(a.requestId,0,recipient,2);rows=await list();assert.equal(duplicateInvitations(rows).size,3);
  assert.deepEqual(rows.find(r=>r.request_id===a.requestId).separate_from,[]);
});

test('duplicate decisions reject stale source/target revisions, crossed suppression races and invalid requests without partial changes',async t=>{
  const {create,resolve,list,update,db}=await setup(t),a=input(),b=input();await create(a);await create(b);
  await update(a.requestId,0,'prepared');
  await assert.rejects(resolve(b.requestId,0,0,'suppress',a.requestId,0,0));
  assert.equal(filterInvitations(await list(),'suppressed').length,0);
  const race=await Promise.allSettled([resolve(a.requestId,0,1,'suppress',b.requestId,0,0),resolve(b.requestId,0,0,'suppress',a.requestId,0,1)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(filterInvitations(await list(),'suppressed').length,1);
  assert.equal((await db.query("select count(*)::int n from gala_invitation_events where kind='duplicate'")).rows[0].n,1);
  for(const args of [[a.requestId,0,1,'bogus'],[b.requestId,0,0,'suppress',randomUUID(),0,0],[a.requestId,19,0,'restore']])await assert.rejects(resolve(...args));
  const payload={action:'duplicate',decision:'suppress',requestId:a.requestId,recipientIndex:0,revision:0,targetRequestId:b.requestId,targetRecipientIndex:0,targetRevision:0,reason:'Reviewed duplicate'};
  assert.equal(invitationPatch.safeParse(payload).success,true);
  for(const patch of [{targetRevision:undefined},{reason:' '},{targetRequestId:a.requestId},{decision:'restore'},{recipientIndex:20},{status:'mailed'}])
    assert.equal(invitationDuplicateUpdate.safeParse({...payload,...patch}).success,false);
});

test('duplicate review tables/functions deny browser roles and allow only server-side review',async t=>{
  const {db,create,resolve}=await setup(t),a=input(),b=input();await create(a);await create(b);
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);
    await assert.rejects(db.query('select * from gala_invitation_separate_pairs'));
    await assert.rejects(resolve(a.requestId,0,0,'separate',b.requestId,0,0));await db.exec('reset role');}
  await db.exec('set role service_role');await resolve(a.requestId,0,0,'separate',b.requestId,0,0);
});
