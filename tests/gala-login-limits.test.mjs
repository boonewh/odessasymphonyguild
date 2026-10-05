import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { testDatabase } from './helpers/gala-database.mjs';
import { authenticateStaff, loginBucket, readLoginBody, LoginBodyTooLarge } from '../lib/gala/backend/staff-login.ts';
import { AccessStore } from '../lib/gala/backend/access-store.ts';
import { DEVELOPMENT_SUPABASE_URL } from '../lib/gala/backend/config.ts';

const key='a'.repeat(64), credentials={email:' Staff@Example.com ',password:'fictional-password'};
async function setup(t){
  const {db}=await testDatabase();t.after(()=>db.close());
  const dir=new URL('../supabase/gala-development/',import.meta.url);
  for(const file of (await readdir(dir)).sort().filter(f=>Number(f.slice(0,3))>=3&&Number(f.slice(0,3))<=10))await db.exec(await readFile(new URL(file,dir),'utf8'));
  const consume=async account=>(await db.query('select gala_consume_staff_login($1) as result',[account])).rows[0].result;
  return {db,consume};
}
test('login admission normalizes account keys, hides emails, and does not call Auth for invalid or throttled input',async()=>{
  assert.equal(loginBucket(credentials.email,key),loginBucket('staff@example.com',key));
  assert.notEqual(loginBucket(credentials.email,key),loginBucket(credentials.email,'b'.repeat(64)));
  assert.match(loginBucket(credentials.email,key),/^[a-f0-9]{64}$/);
  let checked=0,authenticated=0;
  const consume=async bucket=>{checked++;assert.equal(bucket,loginBucket('staff@example.com',key));return {allowed:false,retryAfter:321};};
  const auth=async()=>{authenticated++;return 'staff';};
  assert.deepEqual(await authenticateStaff(credentials,key,consume,auth),{status:429,retryAfter:321});
  for(const raw of [null,{}, {...credentials,email:'invalid'}, {...credentials,password:''},{...credentials,role:'admin'}])assert.equal((await authenticateStaff(raw,key,consume,auth)).status,401);
  assert.equal(checked,1);assert.equal(authenticated,0);
  assert.deepEqual(await authenticateStaff(credentials,key,async()=>{throw new Error('database unavailable');},auth),{status:503,retryAfter:60});
  assert.equal(authenticated,0);
  assert.deepEqual(await authenticateStaff(credentials,key,async()=>({allowed:true,retryAfter:0}),async(email,password)=>{assert.equal(email,'staff@example.com');assert.equal(password,credentials.password);return 'staff';}),{status:200,userId:'staff'});
});

test('login bodies are bounded by actual streamed bytes and cancel oversized requests',async()=>{
  const request=body=>new Request('http://localhost',{method:'POST',body});
  assert.deepEqual(await readLoginBody(request(JSON.stringify(credentials))),credentials);
  let cancelled=false,pulls=0;
  const stream=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(1024));},cancel(){cancelled=true;}},{highWaterMark:0});
  await assert.rejects(readLoginBody(new Request('http://localhost',{method:'POST',headers:{'Content-Length':'1'},body:stream,duplex:'half'})),LoginBodyTooLarge);
  assert.equal(cancelled,true);assert.equal(pulls,3);
  await assert.rejects(readLoginBody(request(JSON.stringify({password:'é'.repeat(1100)}))),LoginBodyTooLarge);
  await assert.rejects(readLoginBody(request('{')));
});

test('parallel requests share five durable account admissions; denials do not slide the deadline',async t=>{
  const {db,consume}=await setup(t),bucket=loginBucket('test@example.com',key);
  const results=await Promise.all(Array.from({length:20},()=>consume(bucket)));
  assert.equal(results.filter(r=>r.allowed).length,5);assert.equal(results.filter(r=>!r.allowed).length,15);
  const row=(await db.query('select * from gala_login_limits where bucket=$1',[bucket])).rows[0];assert.equal(row.attempts,5);
  const denied=await consume(bucket);assert.equal(denied.allowed,false);assert.ok(denied.retryAfter>0&&denied.retryAfter<=900);
  assert.deepEqual((await db.query('select * from gala_login_limits where bucket=$1',[bucket])).rows[0],row);
  await db.exec('set role service_role');assert.equal((await consume(bucket)).allowed,false);await db.exec('reset role');
});

test('service-wide limit bounds rotating identities and prevents blocked requests from growing storage',async t=>{
  const {db,consume}=await setup(t);
  const results=await Promise.all(Array.from({length:150},(_,i)=>consume(loginBucket(`fictional-${i}@example.com`,key))));
  assert.equal(results.filter(r=>r.allowed).length,120);
  assert.equal((await db.query('select count(*)::integer as n from gala_login_limits')).rows[0].n,121);
  await db.exec("update gala_login_limits set expires_at=now()-interval '1 second' where bucket='global'");
  assert.equal((await consume(loginBucket('fresh@example.com',key))).allowed,true);
  await db.exec("update gala_login_limits set expires_at=now()-interval '1 second' where bucket<>'global'");
  assert.equal((await consume(loginBucket('fresh@example.com',key))).allowed,true);
  assert.equal((await db.query('select count(*)::integer as n from gala_login_limits')).rows[0].n,2);
  await assert.rejects(consume('not-a-hash'));await assert.rejects(consume(null));
});

test('success, Auth failure and committed-but-lost limiter responses all consume budget without fail-open retry',async t=>{
  const {db,consume}=await setup(t);let authCalls=0;
  const auth=async()=>{authCalls++;return 'fictional-user';};
  const lost=async bucket=>{await consume(bucket);throw new Error('response lost after commit');};
  assert.equal((await authenticateStaff(credentials,key,lost,auth)).status,503);assert.equal(authCalls,0);
  assert.equal((await authenticateStaff(credentials,key,consume,async()=>{throw new Error('wrong password');})).status,401);
  for(let i=0;i<3;i++)assert.equal((await authenticateStaff(credentials,key,consume,auth)).status,200);
  assert.equal((await authenticateStaff(credentials,key,consume,auth)).status,429);assert.equal(authCalls,3);
  await db.query("update gala_login_limits set expires_at=now()-interval '1 second' where bucket=$1",[loginBucket(credentials.email,key)]);
  assert.equal((await authenticateStaff(credentials,key,consume,auth)).status,200);
});

test('limiter data and functions deny browser roles; server role can only submit valid admission keys',async t=>{
  const {db,consume}=await setup(t);
  for(const role of ['anon','authenticated']){
    await db.exec('set role '+role);await assert.rejects(db.query('select * from gala_login_limits'));
    await assert.rejects(consume(key));await db.exec('reset role');
  }
  await db.exec('set role service_role');assert.equal((await consume(key)).allowed,true);
});

test('Supabase limiter adapter rejects errors and malformed allow responses',async()=>{
  for(const body of [null,{}, {allowed:true}, {allowed:true,retryAfter:10}, {allowed:false,retryAfter:0},{allowed:false,retryAfter:901},{allowed:'true',retryAfter:0}]){
    const store=new AccessStore(DEVELOPMENT_SUPABASE_URL,'sb_secret_fake',async()=>Response.json(body));await assert.rejects(store.consumeLogin(key));
  }
  const store=new AccessStore(DEVELOPMENT_SUPABASE_URL,'sb_secret_fake',async()=>Response.json({allowed:false,retryAfter:42}));assert.deepEqual(await store.consumeLogin(key),{allowed:false,retryAfter:42});
});
