import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createAdminSession, validAdminSession } from '../lib/admin/test-session.ts';
import { adminDestination, sharedAdminTestEnabled } from '../lib/admin/test-access.ts';
import { BOARD_BRANCH, BOARD_PROJECT, BOARD_ORIGIN } from '../lib/gala/board-review.ts';
const key='a'.repeat(64), password='FictionalTestPass', now=1800000000000;
test('shared admin sessions expire on the server and password rotation invalidates every old session',()=>{
  const cookie=createAdminSession(key,password,now);
  assert(validAdminSession(cookie,key,password,now));
  assert(validAdminSession(cookie,key,password,now+8*3600*1000-1));
  assert(!validAdminSession(cookie,key,password,now+8*3600*1000));
  assert(!validAdminSession(cookie,key,'new-password',now));
  assert(!validAdminSession(cookie,'b'.repeat(64),password,now));
  assert(!validAdminSession(cookie,key,password,now-1000));
});
test('shared admin session rejects forged, missing, malformed and unconfigured credentials',()=>{
  const cookie=createAdminSession(key,password,now);
  for(const value of ['',cookie+'x',cookie.replace(/^\d+/,'9999999999'),'admin_session=anything'])assert(!validAdminSession(value,key,password,now));
  assert(!validAdminSession(cookie,'',password,now));assert(!validAdminSession(cookie,key,'',now));
  assert.throws(()=>createAdminSession('',password,now));
  assert.notEqual(cookie,createAdminSession(key,password,now));
});
test('shared admin entrance is limited to local development and the explicitly approved test branch',()=>{
  const env={NODE_ENV:'production',VERCEL:'1',VERCEL_ENV:'preview',VERCEL_PROJECT_ID:BOARD_PROJECT,VERCEL_GIT_COMMIT_REF:BOARD_BRANCH,GALA_BOARD_ORIGIN:BOARD_ORIGIN,GALA_BOARD_REVIEW:'true',GALA_BACKEND_ENABLED:'true'};
  assert(sharedAdminTestEnabled(env));
  for(const patch of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{GALA_BOARD_REVIEW:'false'},{VERCEL_PROJECT_ID:'wrong'}])assert(!sharedAdminTestEnabled({...env,...patch}));
  assert(sharedAdminTestEnabled({NODE_ENV:'development',GALA_BACKEND_ENABLED:'true'}));
  assert(!sharedAdminTestEnabled({NODE_ENV:'development',GALA_BACKEND_ENABLED:'true',GALA_ACCESS_MODE:'individual'}));
});
test('admin return destinations cannot redirect to outside sites or live dues routes',()=>{
  for(const value of ['https://evil.example','//evil.example','/admin/belles-beaux',undefined,'/admin/gala?x=1'])assert.equal(adminDestination(value),'/admin');
  for(const path of ['/admin/dues','/admin/gala','/admin/patron'])assert.equal(adminDestination(path),path);
});
test('shared admin handlers enforce throttling, isolation, CSRF, bounded input and complete logout',()=>{
  const r=spawnSync(process.execPath,['--conditions=react-server','--import','tsx','tests/helpers/shared-admin-route.mts'],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,r.stdout+r.stderr);
});
