import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { localPatronStore } from '../lib/patron/local-store.ts';
import { patronHandlers } from '../lib/patron/http.ts';
import { patronEnabled } from '../lib/patron/config.ts';
import { PATRON_PERIOD } from '../lib/patron/model.ts';
import { authorizeSharedAdmin } from '../lib/admin/test-server.ts';
import { createAdminSession } from '../lib/admin/test-session.ts';
import { DEVELOPMENT_SUPABASE_URL } from '../lib/gala/backend/config.ts';
import { membershipDatabase } from './helpers/membership-database.mjs';
import { supabasePatronStore } from '../lib/patron/store.ts';

const origin = 'http://localhost:3000', key = 'a'.repeat(64);
Object.assign(process.env, { NODE_ENV:'development', GALA_BACKEND_ENABLED:'true', GALA_LOCAL_ORIGIN:origin,
  GALA_DEVELOPMENT_TOKEN:key, GALA_SUPABASE_URL:DEVELOPMENT_SUPABASE_URL, GALA_SUPABASE_SECRET_KEY:'sb_secret_fake',
  GALA_STRIPE_SECRET_KEY:'sk_test_fake', GALA_STRIPE_WEBHOOK_SECRET:'whsec_fake' });
for (const key of ['VERCEL','VERCEL_ENV','GALA_BOARD_REVIEW','GALA_CLIENT_REVIEW','GALA_BOARD_ACCESS_CODE','GALA_ACCESS_MODE']) delete process.env[key];
const cookie = `osg_test_admin_session=${createAdminSession(key,key)}`;
const initialSql = await readFile('supabase/patron/001_patrons.sql','utf8');
const approvalSql = await readFile('supabase/patron/002_approval.sql','utf8');
const sql = initialSql + '\n' + approvalSql + '\n' + await readFile('supabase/patron/003_payments.sql','utf8') + '\n' + await readFile('supabase/patron/004_paid_approval.sql','utf8');
const signup = (extra = {}) => ({ requestId:randomUUID(), name:'Fictional Online Patron', email:'online@example.com', phone:'4325550100', consent:true, company:'', ...extra });
const check = (extra = {}) => ({ requestId:randomUUID(), name:'Fictional Check Patron', email:'', phone:'', published:true, ...extra });
function request(method, body, admin = false, from = origin) {
  return new Request(`${origin}/api/${admin ? 'admin/patrons' : 'patron'}`, {
    method, headers:{origin:from,cookie:admin ? cookie : '', 'Content-Type':'application/json'},
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
}
async function setup(t) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  await db.exec(sql);
  const store = localPatronStore(db);
  let enabled = true;
  const handlers = patronHandlers({ enabled:() => enabled, config:() => ({origin,key,local:true}), authorize:authorizeSharedAdmin, store:async () => store });
  return { db, store, handlers, disable:() => { enabled = false; } };
}

test('online and check entries share a persistent roster; public projection excludes all contact data', async t => {
  const { db, store, handlers } = await setup(t);
  assert.equal((await handlers.signup(request('POST',signup()))).status,200);
  assert.equal((await handlers.add(request('POST',check(),true))).status,200);
  assert.deepEqual(await store.names(PATRON_PERIOD),['Fictional Check Patron']);
  // A new store instance reads saved data, not client state.
  const saved = await localPatronStore(db).list(PATRON_PERIOD);
  assert.equal(saved.length,2); assert.equal(saved.find(p => p.source === 'online').email,'online@example.com');
  assert.equal(saved.find(p => p.source === 'check').email,'');
  const online = saved.find(p => p.source === 'online');
  assert.equal(online.published,false); assert.equal(online.approved_at,null);
  const edited = {id:online.id,name:'Corrected Patron Name',email:online.email,phone:online.phone,published:true};
  assert.equal((await handlers.edit(request('PATCH',{...edited,published:false},true))).status,200);
  assert.deepEqual(await store.names(PATRON_PERIOD),['Fictional Check Patron']);
  assert.equal((await store.list(PATRON_PERIOD)).find(p=>p.id===online.id).approved_at,null);
  assert.equal((await handlers.edit(request('PATCH',edited,true))).status,409);
  assert.equal((await handlers.edit(request('PATCH',{...edited,published:false,checkReceived:true},true))).status,200);
  assert.equal((await handlers.edit(request('PATCH',edited,true))).status,200);
  assert.ok((await store.list(PATRON_PERIOD)).find(p=>p.id===online.id).approved_at);
  assert((await store.names(PATRON_PERIOD)).includes('Corrected Patron Name'));
  assert.equal((await handlers.edit(request('PATCH',{...edited,published:false},true))).status,200);
  assert.deepEqual(await store.names(PATRON_PERIOD),['Fictional Check Patron']);
  assert.equal((await store.list(PATRON_PERIOD)).length,2);
  assert.equal((await handlers.edit(request('PATCH',{...edited,id:randomUUID()},true))).status,404);
  assert.deepEqual(await store.names('2025'),[]);
});

test('admin data and all mutations require the shared session; CSRF, closed mode and malformed inputs fail safely', async t => {
  const {store,handlers,disable} = await setup(t);
  for (const [method,fn,body] of [['GET',handlers.list,null],['POST',handlers.add,check()],['PATCH',handlers.edit,{...check(),id:randomUUID()}]]) {
    const response = await fn(request(method,body));
    assert.equal(response.status,401); assert.match(response.headers.get('cache-control'),/no-store/);
  }
  assert.equal((await handlers.signup(request('POST',signup(),false,'https://evil.example'))).status,403);
  assert.equal((await handlers.add(request('POST',check(),true,'https://evil.example'))).status,401);
  for (const input of [signup({consent:false}),signup({email:'bad'}),signup({name:'<script>alert(1)</script>'}),signup({source:'check'}),signup({published:true}),signup({approved_at:new Date().toISOString()}),signup({name:' '}),signup({phone:'not a phone'})])
    assert.equal((await handlers.signup(request('POST',input))).status,400);
  assert.equal((await handlers.signup(new Request(origin,{method:'POST',headers:{origin},body:'not-json'}))).status,400);
  assert.equal((await handlers.signup(new Request(origin,{method:'POST',headers:{origin},body:'x'.repeat(2049)}))).status,413);
  assert.equal((await handlers.signup(request('POST',signup({company:'bot website'})))).status,200);
  assert.equal((await store.list(PATRON_PERIOD)).length,0);
  disable();
  for (const [method,fn,body] of [['POST',handlers.signup,signup()],['GET',handlers.list,null],['POST',handlers.add,check()]])
    assert.equal((await fn(request(method,body,true))).status,404);
});

test('database forces online inserts pending even from older code; only private updates approve', async t => {
  const {db,store,handlers}=await setup(t);
  const input={...signup(),period:PATRON_PERIOD,source:'online',published:true,clientHash:'a'.repeat(64)};
  await store.add(input);
  assert.deepEqual(await store.names(PATRON_PERIOD),[]);
  assert.equal((await store.list(PATRON_PERIOD))[0].approved_at,null);
  const edit={id:input.requestId,name:input.name,email:input.email,phone:input.phone,published:true};
  assert.equal((await handlers.edit(request('PATCH',edit))).status,401);
  await db.exec('set role anon');
  await assert.rejects(db.query('update patron_members set published=true'),/permission denied/);
  await db.exec('reset role');
  await db.exec('set role service_role');
  await assert.rejects(store.edit(edit,PATRON_PERIOD),/patron_payment_required/);
  await store.edit({...edit,published:false,checkReceived:true},PATRON_PERIOD);
  await store.edit(edit,PATRON_PERIOD);
  const approval=(await store.list(PATRON_PERIOD))[0].approved_at;
  assert.ok(approval);assert.deepEqual(await store.names(PATRON_PERIOD),[input.name]);
  await store.add({...input,published:false});
  assert.deepEqual(await store.names(PATRON_PERIOD),[input.name]);
  await store.edit({...edit,published:false},PATRON_PERIOD);
  await store.add({...input,requestId:randomUUID()});
  assert.deepEqual(await store.names(PATRON_PERIOD),[]);
  assert.deepEqual((await store.list(PATRON_PERIOD))[0].approved_at,approval);
  await db.query("insert into patron_members(id,period,name,email,source,published,approved_at) values($1,$2,'Direct insert','direct@example.com','online',true,now())",[randomUUID(),PATRON_PERIOD]);
  assert.deepEqual(await store.names(PATRON_PERIOD),[]);
});

test('approval migration queues preexisting online names and preserves contacts and check recognition', async t => {
  const db=new PGlite();t.after(()=>db.close());
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(initialSql);
  const store=localPatronStore(db);
  await store.add({...signup(),period:PATRON_PERIOD,source:'online',published:true,clientHash:'b'.repeat(64)});
  await store.add({...check(),period:PATRON_PERIOD,source:'check',clientHash:''});
  const before=await store.list(PATRON_PERIOD);
  await db.exec(approvalSql);
  const after=await store.list(PATRON_PERIOD);
  assert.equal(after.length,2);
  for(const original of before) {
    const migrated=after.find(p=>p.id===original.id);
    for(const key of ['name','email','phone','period','source','created_at']) assert.deepEqual(migrated[key],original[key]);
    assert.equal(migrated.published,original.source==='check');
    assert.equal(Boolean(migrated.approved_at),original.source==='check');
  }
  assert.deepEqual(await store.names(PATRON_PERIOD),['Fictional Check Patron']);
});

test('retries and concurrent duplicates never overwrite contacts or republish hidden patrons', async t => {
  const {store,handlers} = await setup(t);
  const input = signup({email:'  PATRON@example.com  '});
  const responses = await Promise.all([handlers.signup(request('POST',input)),handlers.signup(request('POST',input))]);
  assert(responses.every(response => response.status === 200));
  assert.equal((await store.list(PATRON_PERIOD)).length,1);
  const row = (await store.list(PATRON_PERIOD))[0]; assert.equal(row.email,'patron@example.com');
  await store.edit({id:row.id,name:row.name,email:row.email,phone:'4325550199',published:false},PATRON_PERIOD);
  assert.equal((await handlers.signup(request('POST',signup({email:row.email})))).status,200);
  assert.deepEqual(await store.names(PATRON_PERIOD),[]);
  assert.equal((await store.list(PATRON_PERIOD))[0].phone,'4325550199');
  assert.equal((await handlers.signup(request('POST',{...input,name:'Different Name'}))).status,409);
  const manual = check();
  await handlers.add(request('POST',manual,true)); await handlers.add(request('POST',manual,true));
  assert.equal((await store.list(PATRON_PERIOD)).filter(p => p.source === 'check').length,1);
});

test('durable signup rate limit survives fresh handler instances and does not block check entry', async t => {
  const {db,handlers} = await setup(t);
  for (let i=0;i<5;i++) assert.equal((await handlers.signup(request('POST',signup({email:`patron${i}@example.com`})))).status,200);
  const second = patronHandlers({enabled:() => true,config:() => ({origin,key,local:true}),authorize:authorizeSharedAdmin,store:async () => localPatronStore(db)});
  const limited = await second.signup(request('POST',signup({email:'another@example.com'})));
  assert.equal(limited.status,429); assert.equal(limited.headers.get('retry-after'),'900');
  assert.equal((await second.add(request('POST',check(),true))).status,200);
  await db.exec("update patron_submission_limits set started_at=now()-interval '16 minutes'");
  assert.equal((await second.signup(request('POST',signup({email:'another@example.com'})))).status,200);
});

test('installer keeps membership records/defaults intact and denies anonymous access to contacts and the write function', async t => {
  const db = await membershipDatabase(); t.after(() => db.close());
  const snapshot = async () => ({
    students:(await db.query('select * from students')).rows,
    defaults:(await db.query('select * from pg_default_acl order by oid')).rows,
    schema:(await db.query("select nspacl from pg_namespace where nspname='public'")).rows,
    grants:(await db.query("select relname,relacl,relrowsecurity from pg_class where relnamespace='public'::regnamespace and left(relname,7)<>'patron_' order by oid")).rows,
  });
  const before = await snapshot(); await db.exec(sql); assert.deepEqual(await snapshot(),before);
  for (const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from patron_members'),/permission denied/);
    await assert.rejects(db.query("select patron_add('{}'::jsonb)"),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  const store = localPatronStore(db);
  await store.add({...check(),period:PATRON_PERIOD,source:'check',clientHash:''});
  assert.equal((await store.list(PATRON_PERIOD)).length,1);
  await db.exec('reset role'); assert.deepEqual(await snapshot(),before);
});

test('Patron rollout is separate from existing live Gala routing and never uses local storage on previews', () => {
  const live = {NODE_ENV:'production',VERCEL_ENV:'production',GALA_LIVE_ENABLED:'true'};
  assert.equal(patronEnabled(live),false);
  assert.equal(patronEnabled({...live,PATRON_ENABLED:'true'}),true);
  assert.equal(patronEnabled({...live,PATRON_ENABLED:'true',VERCEL_ENV:'preview'}),false);
  assert.equal(patronEnabled({NODE_ENV:'development',GALA_BACKEND_ENABLED:'true'}),true);
  assert.equal(patronEnabled({NODE_ENV:'development',GALA_BACKEND_ENABLED:'true',PATRON_ENABLED:'false'}),false);
});

test('hosted adapter pages beyond 1,000 names, reads only public columns and uses private writes', async () => {
  const calls = [];
  const transport = async (input, init) => {
    const url = new URL(String(input)); calls.push({url,init});
    if (url.pathname.endsWith('/rpc/patron_add')) {
      assert.equal(init.method,'POST');
      assert.equal(JSON.parse(init.body).p_input.source,'check');
      return new Response(null,{status:204});
    }
    if (init.method === 'PATCH') return Response.json([{id:'saved'}]);
    assert.equal(url.searchParams.get('period'),`eq.${PATRON_PERIOD}`);
    if (url.searchParams.get('select') === 'name') {
      assert.equal(url.searchParams.get('published'),'eq.true');
      const offset = Number(url.searchParams.get('offset'));
      return Response.json(Array.from({length:offset < 1000 ? 500 : 1},(_,i) => ({name:`Patron ${offset+i}`})));
    }
    assert.equal(url.searchParams.has('published'),false);
    return Response.json([{id:'saved',name:'Private Patron',email:'private@example.com',phone:'4325550100'}]);
  };
  const store = supabasePatronStore('https://fictional.supabase.co','sb_secret_fake',transport);
  assert.equal((await store.names(PATRON_PERIOD)).length,1001);
  assert.equal(calls.length,3);
  assert.equal((await store.list(PATRON_PERIOD))[0].email,'private@example.com');
  await store.add({...check(),period:PATRON_PERIOD,source:'check',clientHash:''});
  assert(await store.edit({id:randomUUID(),name:'Updated Name',email:'',phone:'',published:false},PATRON_PERIOD));
});

test('storage outages never report a saved signup or leak internal database messages', async () => {
  const handlers = patronHandlers({enabled:() => true, config:() => ({origin,key,local:true}), authorize:authorizeSharedAdmin,
    store:async () => { throw new Error('private database detail'); }});
  const response = await handlers.signup(request('POST',signup()));
  assert.equal(response.status,503); assert.doesNotMatch(await response.text(),/private database detail/);
  assert.equal((await handlers.list(request('GET',null,true))).status,503);
});
