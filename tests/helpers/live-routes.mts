import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';
import * as admin from '../../app/api/admin/session/route';
import * as buyer from '../../app/api/gala/session/route';
import { POST as legacyLogin } from '../../app/api/admin/login/route';
import { POST as legacyLogout } from '../../app/api/admin/logout/route';
import { GET as duesRoster } from '../../app/api/admin/students/route';
import { authorizeCustomer, authorizeStaff, authorizeOrder } from '../../lib/gala/backend/request-access';
import { createAdminSession } from '../../lib/admin/test-session';
import { createCustomerSession } from '../../lib/gala/backend/access';
import { BOARD_BRANCH, BOARD_PROJECT, BOARD_ORIGIN } from '../../lib/gala/board-review';

const origin='https://gala.example', db='https://abcdefghijklmnopqrst.supabase.co', key='a'.repeat(64), password='OfflineAdmin';
Object.assign(process.env, {NODE_ENV:'production',VERCEL_ENV:'production',VERCEL:'1',GALA_LIVE_ENABLED:'true',GALA_LIVE_ORIGIN:origin,
  GALA_LIVE_SUPABASE_URL:db,GALA_LIVE_SUPABASE_SECRET_KEY:'sb_secret_offline',GALA_LIVE_STRIPE_SECRET_KEY:'sk_live_offline',
  GALA_LIVE_STRIPE_WEBHOOK_SECRET:'whsec_offline',GALA_LIVE_SESSION_SECRET:key,ADMIN_PASSWORD:password,
  NEXT_PUBLIC_SUPABASE_URL:'https://membership.example',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fake_membership'});
delete process.env.GALA_BOARD_REVIEW; delete process.env.GALA_CLIENT_REVIEW;
let calls=0, denied=false, failed=false, marker='osg-gala-production', rosterReads=0;
globalThis.fetch=async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input)); calls++;
  if(url.origin==='https://membership.example' && url.pathname==='/rest/v1/students') {
    assert.equal(init?.method ?? 'GET','GET'); rosterReads++;
    return Response.json([{id:'fictional-roster',first_name:'Offline',last_name:'Student'}]);
  }
  assert.equal(url.origin,db,'Unexpected network call blocked');
  if(url.pathname==='/rest/v1/gala_environment') return Response.json({name:marker});
  assert.equal(url.pathname,'/rest/v1/rpc/gala_consume_staff_login');
  if(failed)return Response.json({message:'offline'},{status:503});
  return Response.json({allowed:!denied,retryAfter:denied?120:0});
};
const req=(path:string,method='GET',cookie='',body?:unknown,from=origin)=>new NextRequest(origin+path,
  {method,headers:{origin:from,host:'gala.example',cookie},body:body===undefined?undefined:JSON.stringify(body)});
const session=(r:Response,name:string)=>r.headers.getSetCookie().find(s=>s.startsWith(name+'='))!.split(';')[0];
const api='/api/admin/session';
assert.equal((await admin.GET(req(api))).status,401);
assert.equal((await admin.POST(req(api,'POST','',{password},'https://evil.example'))).status,403);assert.equal(calls,0);
assert.equal((await admin.POST(req(api,'POST','',{password:'x'.repeat(3000)}))).status,413);assert.equal(calls,0);
assert.equal((await admin.POST(req(api,'POST','',{password:'wrong'}))).status,401);
denied=true;const limit=await admin.POST(req(api,'POST','',{password}));assert.equal(limit.status,429);assert.equal(limit.headers.get('retry-after'),'120');denied=false;
failed=true;assert.equal((await admin.POST(req(api,'POST','',{password}))).status,503);failed=false;
marker='osg-gala-development';assert.equal((await admin.POST(req(api,'POST','',{password}))).status,503);marker='osg-gala-production';
const login=await admin.POST(req(api,'POST','',{password}));assert.equal(login.status,200);
const adminCookie=session(login,'__Host-osg_admin_session');assert.match(login.headers.get('set-cookie')!,/Secure/);
assert.equal((await admin.GET(req(api,'GET',adminCookie))).status,200);

// A code-free buyer receives a stable private identity, never admin privileges.
assert.equal((await buyer.GET(req('/api/gala/session'))).status,401);
assert.equal((await (await buyer.GET(req('/api/gala/session'))).json()).accessMode,'live');
assert.equal((await buyer.POST(req('/api/gala/session','POST','','','https://evil.example'))).status,403);
const b=await buyer.POST(req('/api/gala/session','POST'));assert.equal(b.status,200);
const buyerCookie=session(b,'__Host-osg_gala_customer'); const owner=authorizeCustomer(req('/api/gala/checkout','POST',buyerCookie));
assert.match(owner!,/^[a-f0-9]{64}$/);
const again=await buyer.POST(req('/api/gala/session','POST',buyerCookie));assert.equal(session(again,'__Host-osg_gala_customer'),buyerCookie);
await assert.rejects(()=>authorizeStaff(req('/api/gala/orders','GET',buyerCookie)));
assert.throws(()=>authorizeCustomer(req('/api/gala/checkout','POST',adminCookie)));
assert.equal(authorizeCustomer(req('/api/gala/checkout','POST',adminCookie+'; '+buyerCookie)),owner);
await authorizeStaff(req('/api/gala/orders','GET',adminCookie));assert.equal(await authorizeOrder(req('/api/gala/order','GET',adminCookie)),undefined);
assert.equal(await authorizeOrder(req('/api/gala/order','GET',buyerCookie)),owner);

// The exact middleware protects all Dues endpoints and the old links.
for(const path of ['/admin','/admin/dues','/admin/gala','/admin/belles-beaux','/admin/belles-beaux/add','/admin/belles-beaux/edit/fictional', '/admin/pricing','/api/admin/students','/api/admin/settings']) {
  for(const cookie of ['',buyerCookie,'admin_session=old','osg_test_admin_session='+createAdminSession(key,password),
    '__Host-osg_admin_session='+createAdminSession(key,password)]) {
    const r=await middleware(req(path,'GET',cookie));assert.equal(r.status,path.startsWith('/api/')?401:307,path);
  }
  assert.equal((await middleware(req(path,'GET',adminCookie))).headers.get('x-middleware-next'),'1',path);
}
assert.equal((await middleware(req('/api/admin/students/fictional','DELETE',adminCookie,undefined,'https://evil.example'))).status,401);
assert.equal((await middleware(req('/api/admin/settings','PUT',adminCookie,{},''))).status,401);
assert.equal((await middleware(req('/api/admin/settings','PUT',adminCookie,{}))).headers.get('x-middleware-next'),'1');
const authorized=await middleware(req('/api/admin/students','GET',adminCookie));assert.equal(authorized.headers.get('x-middleware-next'),'1');
assert.equal((await (await duesRoster()).json()).students[0].id,'fictional-roster');assert.equal(rosterReads,1);

const oldLogin=await legacyLogin(req('/api/admin/login','POST','',{password}));assert.equal(oldLogin.status,200);
assert(oldLogin.headers.getSetCookie().some(s=>s.startsWith('admin_session=;')&&s.includes('Max-Age=0')));
assert.equal((await legacyLogout(req('/api/admin/logout','POST',adminCookie,undefined,'https://evil.example'))).status,403);
const logout=await legacyLogout(req('/api/admin/logout','POST',adminCookie));assert.equal(logout.status,200);
assert.equal(logout.headers.getSetCookie().length,2);for(const line of logout.headers.getSetCookie())assert.match(line,/Max-Age=0/);
assert(!logout.headers.get('set-cookie')!.includes('__Host-osg_gala_customer'));
process.env.ADMIN_PASSWORD='rotated';assert.equal((await admin.GET(req(api,'GET',adminCookie))).status,401);process.env.ADMIN_PASSWORD=password;
const expired='__Host-osg_admin_session='+createAdminSession(key,password,Date.now()-8*3600_000,'live');
assert.equal((await middleware(req('/api/admin/students','GET',expired))).status,401);
assert.throws(()=>authorizeCustomer(req('/api/gala/checkout','POST','__Host-osg_gala_customer='+createCustomerSession(key))));

// Origin/configuration failures close only the relevant live surfaces.
assert.equal((await middleware(new NextRequest(origin+'/api/gala/session',{headers:{host:'wrong.example'}}))).status,404);
process.env.ADMIN_PASSWORD='';
assert.equal((await middleware(req('/admin/login'))).status,503);
assert.equal((await middleware(req('/gala/tables'))).headers.get('x-middleware-next'),'1');
process.env.GALA_LIVE_STRIPE_SECRET_KEY='';
assert.equal((await middleware(req('/gala/tables'))).status,503);
assert.equal((await middleware(req('/belles-beaux'))).headers.get('x-middleware-next'),'1');
process.env.ADMIN_PASSWORD=password;process.env.GALA_LIVE_STRIPE_SECRET_KEY='sk_live_offline';

// Even the test-enabled build cannot turn board Preview into live Dues.
Object.assign(process.env,{VERCEL_ENV:'preview',GALA_BOARD_REVIEW:'true',GALA_BACKEND_ENABLED:'true',VERCEL_PROJECT_ID:BOARD_PROJECT,VERCEL_GIT_COMMIT_REF:BOARD_BRANCH,GALA_BOARD_ORIGIN:BOARD_ORIGIN});
assert.equal((await admin.POST(req(api,'POST','',{password}))).status,404);
for(const path of ['/admin/belles-beaux','/api/admin/students','/admin/pricing','/api/admin/session']) {
  const r=await middleware(new NextRequest(BOARD_ORIGIN+path,{headers:{host:new URL(BOARD_ORIGIN).host,cookie:adminCookie}}));assert.equal(r.status,404,path);
}
console.log('Live route, Dues authorization and Preview isolation checks passed using fictional responses only.');
