import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server.js';
import { membershipOAuthFlow, OAUTH_COOKIE } from '../lib/quickbooks/oauth-flow.ts';

const hash = value => createHash('sha256').update(value).digest('hex');
const origin = 'https://example.com';
async function setup(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261004180000_qb_oauth_attempts.sql', import.meta.url), 'utf8'));
  const rpc = async (name, args) => (await db.query(`select ${name}($1,$2,$3) as result`, args)).rows[0].result;
  const store = { issue: (...args) => rpc('qb_oauth_issue', args), consume: (...args) => rpc('qb_oauth_consume', args) };
  const config = { clientId: 'fictional-client', redirectUri: origin + '/api/quickbooks/callback', environment: 'sandbox' };
  const exchanges = [];
  const deps = { config: () => config, store: () => store, adminPassword: () => 'fictional-password',
    authorize: state => 'https://appcenter.intuit.com/connect/oauth2?state=' + state,
    exchangeAndSave: async uri => { exchanges.push(uri); } };
  const flow = membershipOAuthFlow(deps);
  const start = async () => {
    const response = await flow.start(new NextRequest(origin + '/api/quickbooks/auth?key=fictional-password'));
    assert.equal(response.status, 302);
    return { response, state: new URL(response.headers.get('location')).searchParams.get('state'),
      binding: response.cookies.get(OAUTH_COOKIE).value };
  };
  const callback = (attempt, query = 'code=fictional-code&realmId=123') => new NextRequest(
    origin + '/api/quickbooks/callback?' + query + '&state=' + attempt.state,
    { headers: { cookie: `${OAUTH_COOKIE}=${attempt.binding}` } });
  const result = response => new URL(response.headers.get('location')).searchParams.get('qb');
  return { db, store, config, deps, flow, start, callback, result, exchanges };
}

test('authorized initiation stores only hashes and sets a private bounded browser cookie; unauthorized starts write nothing', async t => {
  const c = await setup(t);
  for (const query of ['', '?key=', '?key=wrong', '?key=fictional-password&key=fictional-password']) {
    const response = await c.flow.start(new NextRequest(origin + '/api/quickbooks/auth' + query));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  c.deps.adminPassword = () => undefined;
  assert.equal((await c.flow.start(new NextRequest(origin + '/api/quickbooks/auth?key='))).status, 401);
  assert.equal((await c.db.query('select * from qb_oauth_attempts')).rows.length, 0);
  c.deps.adminPassword = () => 'fictional-password';
  const a = await c.start();
  const cookie = a.response.headers.get('set-cookie');
  for (const part of ['HttpOnly', 'Secure', 'SameSite=lax', 'Max-Age=600', 'Path=/api/quickbooks/callback']) assert.ok(cookie.includes(part));
  assert.equal(a.response.headers.get('referrer-policy'), 'no-referrer');
  assert.ok(a.response.headers.get('cache-control').includes('no-store'));
  const row = (await c.db.query('select *, expires_at > clock_timestamp() and expires_at <= clock_timestamp() + interval \'10 minutes\' as bounded from qb_oauth_attempts')).rows[0];
  assert.equal(row.state_hash, hash(a.state));
  assert.equal(row.binding_hash, hash(a.binding));
  assert.notEqual(a.state, a.binding);
  assert.equal(row.bounded, true);
});

test('missing, mismatched, duplicate, cross-browser and changed-config state cannot exchange or consume a valid attempt', async t => {
  const c = await setup(t); const a = await c.start(); const b = await c.start();
  const invalid = [new NextRequest(origin + '/api/quickbooks/callback?code=x&realmId=123'),
    new NextRequest(origin + '/api/quickbooks/callback?code=x&realmId=123&state=' + a.state),
    c.callback({ ...a, state: 'f'.repeat(64) }), c.callback({ ...a, binding: b.binding }),
    c.callback(a, 'code=x&realmId=123&state=' + a.state)];
  for (const request of invalid) assert.equal(c.result(await c.flow.callback(request)), 'error');
  c.config.clientId = 'different-client';
  assert.equal(c.result(await c.flow.callback(c.callback(a))), 'error');
  c.config.clientId = 'fictional-client';
  assert.equal(c.exchanges.length, 0);
  assert.equal((await c.db.query('select * from qb_oauth_attempts')).rows.length, 2);
  assert.equal(c.result(await c.flow.callback(c.callback(a))), 'connected');
});

test('valid callbacks atomically consume state before exchange; parallel and later replay cannot exchange twice', async t => {
  const c = await setup(t); const a = await c.start();
  c.deps.exchangeAndSave = async uri => {
    assert.equal((await c.db.query('select * from qb_oauth_attempts')).rows.length, 0);
    c.exchanges.push(uri);
  };
  const responses = await Promise.all([c.flow.callback(c.callback(a)), c.flow.callback(c.callback(a))]);
  assert.deepEqual(responses.map(c.result).sort(), ['connected', 'error']);
  assert.equal(c.exchanges.length, 1);
  assert.equal(c.result(await c.flow.callback(c.callback(a))), 'error');
  for (const response of responses) {
    assert.equal(response.status, 302);
    assert.ok(response.headers.get('set-cookie').includes('Max-Age=0'));
    assert.ok(response.headers.get('cache-control').includes('no-store'));
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  }
});

test('server expiry rejects a retained cookie and issuance cleans expired attempts', async t => {
  const c = await setup(t); const a = await c.start();
  await c.db.exec("update qb_oauth_attempts set expires_at = clock_timestamp() - interval '1 second'");
  assert.equal(c.result(await c.flow.callback(c.callback(a))), 'error');
  assert.equal(c.exchanges.length, 0);
  await c.start();
  assert.equal((await c.db.query('select * from qb_oauth_attempts')).rows.length, 1);
});

test('declines, malformed codes and provider/save failures consume state and require a fresh start', async t => {
  const c = await setup(t);
  for (const query of ['error=access_denied', 'code=&realmId=123', 'code=a&code=b&realmId=123']) {
    const a = await c.start();
    assert.notEqual(c.result(await c.flow.callback(c.callback(a, query))), 'connected');
    assert.equal(c.result(await c.flow.callback(c.callback(a))), 'error');
  }
  assert.equal(c.exchanges.length, 0);
  let calls = 0;
  c.deps.exchangeAndSave = async () => { calls++; throw new Error('fictional exchange/save failure'); };
  const a = await c.start();
  assert.equal(c.result(await c.flow.callback(c.callback(a))), 'error');
  assert.equal(c.result(await c.flow.callback(c.callback(a))), 'error');
  assert.equal(calls, 1);
});

test('database/configuration failures fail closed before redirect or token exchange', async t => {
  const c = await setup(t); const a = await c.start();
  c.deps.store = () => { throw new Error('database unavailable or migration missing'); };
  const response = await c.flow.start(new NextRequest(origin + '/api/quickbooks/auth?key=fictional-password'));
  assert.equal(response.status, 503); assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(c.result(await c.flow.callback(c.callback(a))), 'error');
  assert.equal(c.exchanges.length, 0);
  c.deps.store = () => c.store;
  c.config.redirectUri = 'https://other.example/api/quickbooks/callback';
  assert.equal((await c.flow.start(new NextRequest(origin + '/api/quickbooks/auth?key=fictional-password'))).status, 503);
  assert.equal(c.result(await c.flow.callback(c.callback(a))), 'error');
  assert.equal(c.exchanges.length, 0);
});

test('browser roles cannot read, issue or consume OAuth attempts; service role can use only the RPCs', async t => {
  const c = await setup(t); const args = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
  for (const role of ['anon', 'authenticated']) {
    await c.db.exec('set role ' + role);
    await assert.rejects(c.db.query('select * from qb_oauth_attempts'), /permission denied/);
    await assert.rejects(c.store.issue(...args), /permission denied/);
    await assert.rejects(c.store.consume(...args), /permission denied/);
    await c.db.exec('reset role');
  }
  await c.db.exec('set role service_role');
  await assert.rejects(c.db.query('select * from qb_oauth_attempts'), /permission denied/);
  await c.store.issue(...args);
  assert.equal(await c.store.consume(...args), true);
  assert.equal(await c.store.consume(...args), false);
  await c.db.exec('reset role');
});
