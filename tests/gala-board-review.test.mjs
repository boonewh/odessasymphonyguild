import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_BRANCH, BOARD_PROJECT, BOARD_ORIGIN, boardReviewAllowed, boardReviewRequest } from '../lib/gala/board-review.ts';
import { backendEnabled, readBackendConfig, DEVELOPMENT_SUPABASE_URL } from '../lib/gala/backend/config.ts';
import { createDevelopmentSession, DEVELOPMENT_COOKIE } from '../lib/gala/backend/auth.ts';
import { customerAccess, staffAccess } from '../lib/gala/backend/access.ts';
import { authorizeScheduledRecovery } from '../lib/gala/backend/scheduled-recovery.ts';
import { recoveryPass } from '../lib/gala/backend/recovery.ts';
import { sessionParameters } from '../lib/gala/backend/checkout.ts';
import { NextRequest } from 'next/server.js';
import { middleware } from '../middleware.ts';

const env = {
  NODE_ENV:'production', VERCEL:'1', VERCEL_ENV:'preview', VERCEL_PROJECT_ID:BOARD_PROJECT,
  VERCEL_GIT_COMMIT_REF:BOARD_BRANCH, GALA_BOARD_REVIEW:'true', GALA_BOARD_ORIGIN:BOARD_ORIGIN,
  GALA_BACKEND_ENABLED:'true', GALA_STRIPE_SECRET_KEY:'sk_test_fake', GALA_SUPABASE_URL:DEVELOPMENT_SUPABASE_URL,
  GALA_SUPABASE_SECRET_KEY:'sb_secret_fake', GALA_STRIPE_WEBHOOK_SECRET:'whsec_fake',
  GALA_DEVELOPMENT_TOKEN:'a'.repeat(64), GALA_BOARD_ACCESS_CODE:'b'.repeat(32), GALA_RECOVERY_SECRET:'c'.repeat(64),
};

test('board backend opens only the pinned opted-in Preview branch, project and HTTPS origin', () => {
  assert.equal(boardReviewAllowed(env), true);
  assert.equal(backendEnabled(env), true);
  for (const patch of [{VERCEL_ENV:'production'}, {VERCEL_ENV:'development'}, {VERCEL_ENV:undefined},
    {VERCEL:undefined}, {VERCEL_PROJECT_ID:'other'}, {VERCEL_GIT_COMMIT_REF:'main'},
    {GALA_BOARD_REVIEW:'false'}, {GALA_BACKEND_ENABLED:'false'}, {GALA_CLIENT_REVIEW:'true'},
    {GALA_BOARD_ORIGIN:'https://evil.example'}, {GALA_BOARD_ORIGIN:BOARD_ORIGIN+'/'},
    {GALA_BOARD_ORIGIN:BOARD_ORIGIN.replace('https:','http:')}]) {
    assert.equal(boardReviewAllowed({...env,...patch}), false, JSON.stringify(patch));
    assert.equal(backendEnabled({...env,...patch}), false, JSON.stringify(patch));
    assert.throws(()=>readBackendConfig({...env,...patch}));
  }
});

test('hosted config rejects live resources, shared signing/access secrets and accounting writes', () => {
  const config=readBackendConfig(env);
  assert.equal(config.hosted,true);assert.equal(config.origin,BOARD_ORIGIN);assert.equal(config.accessCode,env.GALA_BOARD_ACCESS_CODE);
  for(const patch of [{GALA_STRIPE_SECRET_KEY:'sk_live_fake'}, {GALA_SUPABASE_URL:'https://live.supabase.co'},
    {GALA_SUPABASE_SECRET_KEY:'other'}, {GALA_DEVELOPMENT_TOKEN:'short'}, {GALA_STRIPE_WEBHOOK_SECRET:''},
    {GALA_BOARD_ACCESS_CODE:''},{GALA_BOARD_ACCESS_CODE:env.GALA_DEVELOPMENT_TOKEN},
    {GALA_QB_SYNC_ENABLED:'true'},{GALA_ACCESS_MODE:'individual'}]) assert.throws(()=>readBackendConfig({...env,...patch}));
});

test('board route allowlist permits walkthrough methods but denies membership, labs and accounting writes', () => {
  for(const path of ['/gala/tables','/gala/gifts','/gala/invitations','/gala/preview/admin','/gala/preview/payment']) {
    assert.equal(boardReviewRequest(path,'GET'),'allowed');assert.equal(boardReviewRequest(path,'POST'),'blocked');
  }
  for(const path of ['/api/gala/checkout','/api/gala/webhook','/api/gala/recovery/run']) {
    assert.equal(boardReviewRequest(path,'POST'),'allowed');assert.equal(boardReviewRequest(path,'GET'),'blocked');
  }
  assert.equal(boardReviewRequest('/api/gala/invitations','PATCH'),'allowed');
  assert.equal(boardReviewRequest('/api/gala/session','DELETE'),'allowed');
  for(const path of ['/api/admin/students','/admin/login','/belles-beaux/join','/api/quickbooks/webhook',
    '/api/gala/quickbooks/sync','/api/gala/quickbooks/connect','/api/gala/quickbooks/callback','/api/gala/staff-session',
    '/gala/preview/testing','/api/gala/orders/unexpected','/gala/tables/extra']) {
    for(const method of ['GET','POST','DELETE']) assert.equal(boardReviewRequest(path,method),'blocked');
  }
});

test('hosted cookies authorize the walkthrough, reject CSRF and do not accept a development header', async () => {
  const config=readBackendConfig(env), cookie=`${DEVELOPMENT_COOKIE}=${createDevelopmentSession(config.token)}`;
  const req=(headers={})=>new Request(BOARD_ORIGIN+'/api/gala/assignments',{method:'POST',headers});
  const lookup=()=>{throw new Error('Shared board test must not use named staff lookup');};
  assert.equal(customerAccess(req({cookie,origin:BOARD_ORIGIN}),config),undefined);
  await staffAccess(req({cookie,origin:BOARD_ORIGIN}),config,false,lookup);
  assert.throws(()=>customerAccess(req({'x-gala-development-token':config.token}),config));
  await assert.rejects(()=>staffAccess(req({cookie,origin:'https://evil.example'}),config,false,lookup));
  assert.throws(()=>customerAccess(req({cookie:`${DEVELOPMENT_COOKIE}=${createDevelopmentSession(env.GALA_BOARD_ACCESS_CODE)}`,origin:BOARD_ORIGIN}),config));
});

test('scheduled recovery requires its own secret and cannot run in production or use a browser login', () => {
  const request=secret=>new Request(BOARD_ORIGIN+'/api/gala/recovery/run',{method:'POST',headers:{authorization:`Bearer ${secret}`}});
  assert.equal(authorizeScheduledRecovery(request(env.GALA_RECOVERY_SECRET),env),true);
  for(const secret of ['',env.GALA_BOARD_ACCESS_CODE,env.GALA_DEVELOPMENT_TOKEN]) assert.equal(authorizeScheduledRecovery(request(secret),env),false);
  assert.equal(authorizeScheduledRecovery(request(env.GALA_RECOVERY_SECRET),{...env,VERCEL_ENV:'production'}),false);
  assert.equal(authorizeScheduledRecovery(request(env.GALA_DEVELOPMENT_TOKEN),{...env,GALA_RECOVERY_SECRET:env.GALA_DEVELOPMENT_TOKEN}),false);
});

test('recovery invocation stops claiming work once its time budget is exhausted', async () => {
  let claims=0,finished=0;
  const queue={claim:async()=>{claims++;await new Promise(resolve=>setTimeout(resolve,15));return {id:'settled',status:'paid'};},finish:async()=>{finished++;}};
  assert.deepEqual(await recoveryPass(queue,{}, {},5,5),{checked:1});
  assert.equal(claims,1);assert.equal(finished,1);
  assert.deepEqual(await recoveryPass(queue,{}, {},5,0),{checked:0});
});

test('test checkout returns to the approved HTTPS review origin without declaring payment', () => {
  const result=sessionParameters({id:'test-order',details:{kind:'tables',contact:{name:'Fictional',email:'fictional@example.com'}},amount:200000,description:'Silver table',created_at:new Date().toISOString()},readBackendConfig(env).origin);
  assert.equal(new URL(result.success_url).origin,BOARD_ORIGIN);
  assert.equal(new URL(result.cancel_url).origin,BOARD_ORIGIN);
  assert.equal(new URL(result.success_url).searchParams.has('paid'),false);
});

test('actual middleware isolates the board host and fails closed on wrong aliases or conflicting flags', async () => {
  const previous={...process.env};
  try {
    Object.assign(process.env,env);delete process.env.GALA_CLIENT_REVIEW;
    const req=url=>new NextRequest(url,{headers:{host:new URL(url).host}});
    const response=await middleware(req(BOARD_ORIGIN+'/gala/preview/admin'));
    assert.equal(response.headers.get('x-middleware-next'),'1');
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.match(response.headers.get('x-robots-tag'),/noindex/);
    for(const url of ['https://unapproved.vercel.app/gala/tables',BOARD_ORIGIN+'/api/admin/students',BOARD_ORIGIN+'/api/gala/quickbooks/sync'])
      assert.equal((await middleware(req(url))).status,404);
    process.env.GALA_CLIENT_REVIEW='true';
    assert.equal((await middleware(req(BOARD_ORIGIN+'/gala/tables'))).status,404);
    delete process.env.GALA_CLIENT_REVIEW;process.env.VERCEL_GIT_COMMIT_REF='main';
    assert.equal((await middleware(req(BOARD_ORIGIN+'/gala/preview/admin'))).status,404);
  } finally {
    for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];
    Object.assign(process.env,previous);
  }
});
