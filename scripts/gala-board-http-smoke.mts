// Run after npm run build. Uses fake provider credentials; never submits a purchase.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { BOARD_BRANCH, BOARD_PROJECT, BOARD_ORIGIN } from '../lib/gala/board-review';
import { DEVELOPMENT_SUPABASE_URL } from '../lib/gala/backend/config';
const port = 3106, local = `http://127.0.0.1:${port}`;
const fake = {
  NODE_ENV:'production', VERCEL:'1', VERCEL_ENV:'preview', VERCEL_PROJECT_ID:BOARD_PROJECT,
  VERCEL_GIT_COMMIT_REF:BOARD_BRANCH, GALA_BOARD_REVIEW:'true', GALA_BOARD_ORIGIN:BOARD_ORIGIN,
  GALA_BACKEND_ENABLED:'true', GALA_CLIENT_REVIEW:'false', GALA_ACCESS_MODE:'development', GALA_QB_SYNC_ENABLED:'false',
  GALA_STRIPE_SECRET_KEY:'sk_test_fake', GALA_SUPABASE_URL:DEVELOPMENT_SUPABASE_URL,
  GALA_SUPABASE_SECRET_KEY:'sb_secret_fake', GALA_STRIPE_WEBHOOK_SECRET:'whsec_fake',
  GALA_DEVELOPMENT_TOKEN:'a'.repeat(64), GALA_BOARD_ACCESS_CODE:'HallTest123', GALA_RECOVERY_SECRET:'c'.repeat(64),
};
let checks=0;
type TestRequest = { method?: string; headers?: Record<string,string>; body?: string };
async function withServer(overrides:Record<string,string>, run:()=>Promise<void>) {
  const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
    env:{...process.env,...fake,...overrides},stdio:['ignore','pipe','pipe'],windowsHide:true,
  });
  let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
  const exited=new Promise<void>(resolve=>child.on('exit',()=>resolve()));
  try {
    for(let i=0;i<100&&!output.includes('Ready in');i++) {
      if(child.exitCode!==null)throw new Error('Test server failed to start: '+output);
      await delay(100);
    }
    assert.match(output,/Ready in/);await run();
  } finally {child.kill();await exited;}
}
async function request(path:string,init:TestRequest={}) {
  // Raw HTTP preserves the public Host used by the Vercel reverse proxy;
  // fetch implementations can replace it with the local connection host.
  return new Promise<Response>((resolve,reject)=>{
    const req=httpRequest(local+path,{method:init.method||'GET',headers:{host:new URL(BOARD_ORIGIN).host,'x-forwarded-proto':'https',...init.headers}},res=>{
      const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{
        const headers=new Headers();for(const [key,value]of Object.entries(res.headers)) {
          if(Array.isArray(value))for(const item of value)headers.append(key,item);else if(value)headers.set(key,value);
        }
        resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers}));
      });res.on('error',reject);
    });req.on('error',reject);req.end(init.body||undefined);
  });
}
async function status(path:string,expected:number,init:TestRequest={}) {
  const response=await request(path,init);assert.equal(response.status,expected,`${init.method||'GET'} ${path}`);checks++;return response;
}
await withServer({},async()=>{
  for(const path of ['/gala/tables','/gala/gifts','/gala/invitations','/gala/preview/admin','/gala/preview/payment']) {
    const response=await status(path,200);assert.match(response.headers.get('x-robots-tag')||'',/noindex/);
    const html=await response.text();assert.doesNotMatch(html,/href="\/admin\/belles-beaux"/);
    assert.doesNotMatch(html,/sk_test_fake|sb_secret_fake|whsec_fake|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/);
  }
  for(const path of ['/admin/belles-beaux','/api/admin/students','/api/quickbooks/webhook','/belles-beaux/join','/gala/preview/testing'])await status(path,404);
  for(const path of ['/api/gala/orders','/api/gala/order','/api/gala/assignments','/api/gala/gifts','/api/gala/invitations','/api/gala/recovery'])await status(path,401);
  await status('/api/gala/quickbooks/sync',404,{method:'POST'});
  await status('/api/gala/recovery/run',401,{method:'POST'});
  await status('/api/gala/recovery/run',404);
  await status('/api/gala/session',403,{method:'POST',headers:{origin:'https://attacker.example'},body:JSON.stringify({token:fake.GALA_BOARD_ACCESS_CODE})});
  await status('/api/gala/session',403,{method:'POST',headers:{origin:BOARD_ORIGIN},body:JSON.stringify({token:fake.GALA_DEVELOPMENT_TOKEN})});
  await status('/api/gala/session',413,{method:'POST',headers:{origin:BOARD_ORIGIN},body:'x'.repeat(4096)});
  const login=await status('/api/gala/session',200,{method:'POST',headers:{origin:BOARD_ORIGIN},body:JSON.stringify({token:fake.GALA_BOARD_ACCESS_CODE})});
  const setCookie=login.headers.get('set-cookie')||'';
  assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/Secure/i);assert.match(setCookie,/SameSite=lax/i);
  assert.doesNotMatch(setCookie,/Domain=/i);
  const cookie=setCookie.split(';')[0];
  await status('/api/gala/session',200,{headers:{cookie}});
  await status('/api/gala/session',403,{method:'DELETE',headers:{cookie,origin:'https://attacker.example'}});
  const logout=await status('/api/gala/session',200,{method:'DELETE',headers:{cookie,origin:BOARD_ORIGIN}});
  assert.match(logout.headers.get('set-cookie')||'',/Max-Age=0/i);
  await status('/api/gala/orders',401,{headers:{'x-gala-development-token':fake.GALA_DEVELOPMENT_TOKEN}});
  await status('/gala/tables',404,{headers:{host:'unapproved.vercel.app'}});
});
await withServer({VERCEL_ENV:'production'},async()=>{
  for(const path of ['/gala/tables','/gala/gifts','/gala/invitations','/gala/preview/admin','/gala/preview/payment','/gala/preview/testing',
    '/api/gala/session','/api/gala/orders','/api/gala/order','/api/gala/assignments','/api/gala/gifts','/api/gala/invitations','/api/gala/recovery','/api/gala/quickbooks/status'])await status(path,404);
  for(const path of ['/api/gala/checkout','/api/gala/session','/api/gala/webhook','/api/gala/recovery/run','/api/gala/quickbooks/sync'])await status(path,404,{method:'POST'});
});
console.log(`Passed ${checks} built-app Preview/production HTTP checks. Fake credentials only; no provider writes.`);
