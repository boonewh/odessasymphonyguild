import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { testDatabase } from './helpers/gala-database.mjs';
import { priceRequest } from '../lib/gala/backend/domain.ts';
import { createCustomerSession, customerIdentity, secretHash, sameOrigin, staffSessionHash, staffAccess, customerAccess } from '../lib/gala/backend/access.ts';
import { createDevelopmentSession } from '../lib/gala/backend/auth.ts';
import { readBackendConfig, DEVELOPMENT_SUPABASE_URL } from '../lib/gala/backend/config.ts';
import { SupabaseOrderStore } from '../lib/gala/backend/store.ts';
import { AccessStore } from '../lib/gala/backend/access-store.ts';

const key='a'.repeat(64), alice='b'.repeat(64), bob='c'.repeat(64);
const input=()=>({requestId:randomUUID(),kind:'tables',contact:{name:'Fictional Access Test',email:'test@example.com',phone:'4325550100'},allSalesFinal:true,purchase:{product:'silver',quantity:1,extraSeats:0}});
test('customer and shared-development credentials cannot enter individual staff or accounting paths',async()=>{
  const config={accessMode:'individual',token:key,origin:'http://localhost:3000'};
  const cookie=createCustomerSession(key);
  for(const headers of [{cookie:`gala_customer_session=${cookie}`},{cookie:`gala_development_session=${createDevelopmentSession(key)}`},{'x-gala-development-token':key}]) {
    await assert.rejects(staffAccess(new Request(config.origin,{headers}),config,false,async()=>assert.fail('must reject before database lookup')));
  }
  const customer=new Request(config.origin,{method:'POST',headers:{origin:config.origin,cookie:`gala_customer_session=${cookie}`}});
  assert.equal(customerAccess(customer,config),customerIdentity(cookie,key));
  const staff=new Request(config.origin,{method:'POST',headers:{origin:config.origin,cookie:`gala_staff_session=${bob}`}});
  assert.throws(()=>customerAccess(staff,config));
  await staffAccess(staff,config,true,async(hash,accounting)=>{assert.equal(hash,secretHash(bob));assert.equal(accounting,true);});
  await assert.rejects(staffAccess(staff,config,false,async()=>{throw new Error('revoked or database unavailable');}));
});
async function setup(t) {
  const {db,store}=await testDatabase();t.after(()=>db.close());
  const dir=new URL('../supabase/gala-development/',import.meta.url);
  for(const file of (await readdir(dir)).sort().filter(f=>/^00[3-9]_.*\.sql$/.test(f))) await db.exec(await readFile(new URL(file,dir),'utf8'));
  const rpc=async(name,args)=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;
  const reserve=(owner,q)=>rpc('gala_customer_reserve',[owner,q.details.requestId,q.hash,q.details,q.amount,q.description,q.tier]);
  const user=randomUUID(), session=secretHash('fictional-staff');
  await db.query('insert into gala_staff values($1,true,false)',[user]);
  await rpc('gala_create_staff_session',[user,session,28800]);
  return {db,store,rpc,reserve,user,session};
}

test('customer cookies expire, resist tampering and cannot reuse the development credential',()=>{
  const now=Date.now(), cookie=createCustomerSession(key,now), identity=customerIdentity(cookie,key,now);
  assert.match(identity,/^[a-f0-9]{64}$/);assert.notEqual(identity,customerIdentity(createCustomerSession(key,now),key,now));
  for(const [value,signing,time] of [[cookie+'x',key,now],[cookie,bob,now],[cookie,key,now+86400_000],[createDevelopmentSession(key,now),key,now]])
    assert.throws(()=>customerIdentity(value,signing,time));
  assert.throws(()=>staffSessionHash(new Request('http://localhost',{headers:{cookie:`gala_customer_session=${cookie}`}})));
  for(const method of ['POST','PATCH','DELETE']) {
    assert.throws(()=>sameOrigin(new Request('http://localhost',{method,headers:{origin:'https://evil.example'}}),'http://localhost'));
    sameOrigin(new Request('http://localhost',{method,headers:{origin:'http://localhost'}}),'http://localhost');
  }
});

test('individual access cannot enable production, hosted preview, live credentials or unknown access modes',()=>{
  const env={NODE_ENV:'development',GALA_BACKEND_ENABLED:'true',GALA_ACCESS_MODE:'individual',GALA_STRIPE_SECRET_KEY:'sk_test_fake',GALA_SUPABASE_URL:DEVELOPMENT_SUPABASE_URL,GALA_SUPABASE_SECRET_KEY:'sb_secret_fake',GALA_STRIPE_WEBHOOK_SECRET:'whsec_fake',GALA_DEVELOPMENT_TOKEN:key};
  assert.equal(readBackendConfig(env).accessMode,'individual');
  for(const change of [{NODE_ENV:'production'},{VERCEL:'1'},{VERCEL_ENV:'preview'},{GALA_CLIENT_REVIEW:'true'},{GALA_ACCESS_MODE:'typo'},{GALA_STRIPE_SECRET_KEY:'sk_live_fake'},{GALA_SUPABASE_URL:'https://other.supabase.co'}]) assert.throws(()=>readBackendConfig({...env,...change}));
});

test('reservation ownership is atomic, retryable, and cannot claim another customer or legacy fixture',async t=>{
  const {db,store,reserve}=await setup(t),q=priceRequest(input());
  const results=await Promise.allSettled([reserve(alice,q),reserve(bob,q)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const owner=(await db.query('select customer_hash from gala_orders where id=$1',[q.details.requestId])).rows[0].customer_hash;
  await reserve(owner,q);await assert.rejects(reserve(owner===alice?bob:alice,q));
  await assert.rejects(reserve(null,priceRequest(input())));
  const legacy=priceRequest(input());await store.reserve(legacy);await assert.rejects(reserve(alice,legacy));
  assert.equal((await db.query('select count(*)::integer as n from gala_orders')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::integer as n from gala_accounting_outbox')).rows[0].n,0);
});

test('invitation retries enforce ownership without exposing or duplicating another submission',async t=>{
  const {rpc,db}=await setup(t);
  const details={requestId:randomUUID(),contact:{name:'Fictional Requester',email:'test@example.com',phone:'4325550100'},recipients:[{name:'Fictional Recipient',line1:'123 Test St',line2:'',city:'Odessa',state:'TX',postalCode:'79761'}]};
  await rpc('gala_customer_invitations',[alice,details]);await rpc('gala_customer_invitations',[alice,details]);
  await assert.rejects(rpc('gala_customer_invitations',[bob,details]));
  assert.equal((await db.query('select count(*)::integer as n from gala_invitation_recipients')).rows[0].n,1);
});

test('staff roles, expiry, logout and revocation fail closed, including the mutation transaction',async t=>{
  const {db,store,rpc,user,session}=await setup(t),q=priceRequest(input());
  await store.reserve(q);await store.bind(q.details.requestId,'cs_test_access');await store.apply(q.details.requestId,'cs_test_access','paid','pi_access','evt_access');
  await db.exec('set role service_role');
  assert.equal((await rpc('gala_staff_identity',[session,false])).userId,user);
  await assert.rejects(rpc('gala_staff_identity',[session,true]));
  await rpc('gala_staff_mutation',[session,'gala_assign_table',{p_order:q.details.requestId,p_number:11,p_revision:0}]);
  assert.equal((await db.query('select actor from gala_assignment_events')).rows[0].actor,user);
  await assert.rejects(rpc('gala_staff_mutation',[session,'gala_apply_payment',{}]));
  await db.query('update gala_staff set enabled=false where user_id=$1',[user]);
  await assert.rejects(rpc('gala_staff_mutation',[session,'gala_assign_table',{p_order:q.details.requestId,p_number:12,p_revision:1}]));
  await assert.rejects(rpc('gala_create_staff_session',[user,key,28800]));
  await db.query('update gala_staff set enabled=true,accounting=true where user_id=$1',[user]);
  assert.equal((await rpc('gala_staff_identity',[session,true])).accounting,true);
  await db.query("update gala_staff_sessions set expires_at=now()-interval '1 second' where token_hash=$1",[session]);
  await assert.rejects(rpc('gala_staff_identity',[session,false]));
  await rpc('gala_create_staff_session',[user,key,28800]);await db.query('delete from gala_staff_sessions where token_hash=$1',[key]);
  await assert.rejects(rpc('gala_staff_identity',[key,false]));
  await db.exec('reset role');
  await store.reserve(priceRequest(input()));
  await rpc('gala_assign_table',[q.details.requestId,13,1]);
  assert.equal((await db.query('select actor from gala_assignment_events order by revision desc limit 1')).rows[0].actor,'local-development-admin');
});

test('new identity tables and RPCs are inaccessible to anonymous and authenticated database clients',async t=>{
  const {db,rpc,session}=await setup(t);
  for(const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    for(const table of ['gala_staff','gala_staff_sessions']) await assert.rejects(db.query('select * from '+table));
    await assert.rejects(rpc('gala_staff_identity',[session,false]));
    await assert.rejects(rpc('gala_staff_mutation',[session,'gala_assign_table',{}]));
    await db.exec('reset role');
  }
});

test('service adapters scope order reads, reservations and staff edits; identity errors never grant access',async()=>{
  const calls=[];
  const transport=async(url,init)=>{calls.push({url:String(url),body:init?.body?JSON.parse(init.body):null});return Response.json({id:randomUUID()});};
  const store=new SupabaseOrderStore(DEVELOPMENT_SUPABASE_URL,'sb_secret_fake',transport);store.customerHash=alice;
  await store.get(randomUUID());await store.reserve(priceRequest(input()));
  assert.ok(calls[0].url.includes('customer_hash=eq.'+alice));
  assert.ok(calls[1].url.endsWith('/rpc/gala_customer_reserve'));assert.equal(calls[1].body.p_customer,alice);
  store.staffSession=bob;await store.assignTable({orderId:randomUUID(),tableNumber:11,revision:0});
  assert.ok(calls[2].url.endsWith('/rpc/gala_staff_mutation'));assert.equal(calls[2].body.p_session,bob);
  const access=new AccessStore(DEVELOPMENT_SUPABASE_URL,'sb_secret_fake',async()=>Response.json({message:'unavailable'},{status:503}));
  await assert.rejects(access.staff(bob));
});

test('staff session rotation cannot succeed when prior-session revocation fails or its response is lost',async()=>{
  for(const failure of ['before-delete','after-delete',null]){
    const sessions=new Set([alice]);let creates=0;
    const access=new AccessStore(DEVELOPMENT_SUPABASE_URL,'sb_secret_fake',async(url,init)=>{
      if(init.method==='DELETE'){
        if(failure!=='before-delete')sessions.delete(alice);
        return failure?Response.json({message:'unavailable'},{status:503}):new Response(null,{status:204});
      }
      assert.ok(String(url).endsWith('/rpc/gala_create_staff_session'));
      creates++;sessions.add(JSON.parse(init.body).p_session);return new Response(null,{status:204});
    });
    if(failure){await assert.rejects(access.rotateSession(randomUUID(),bob,alice));assert.equal(creates,0);assert.equal(sessions.has(bob),false);}
    else{await access.rotateSession(randomUUID(),bob,alice);assert.deepEqual([...sessions],[bob]);assert.equal(creates,1);}
    assert.equal(sessions.has(alice),failure==='before-delete');
  }
});
