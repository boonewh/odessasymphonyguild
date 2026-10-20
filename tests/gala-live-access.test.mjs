import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminSession, validAdminSession } from '../lib/admin/test-session.ts';
import { createCustomerSession, customerIdentity, LIVE_CUSTOMER_COOKIE } from '../lib/gala/backend/access.ts';
import { LIVE_ADMIN_COOKIE, authorizeLiveAdmin, createLiveAdminSession, liveAdminCookieOptions } from '../lib/admin/live-session.ts';
import { authorizeLiveCustomer, liveCustomerSession, liveCustomerCookieOptions } from '../lib/gala/backend/live-customer.ts';
import { SupabaseOrderStore } from '../lib/gala/backend/store.ts';
import { GalaSalesClosed, priceRequest } from '../lib/gala/backend/domain.ts';

const now = 1800000000000;
const config = { key: 'a'.repeat(64), password: 'OfflineSharedPassword', origin: 'https://gala.example' };
const request = (cookie = '', method = 'GET', origin = config.origin) => new Request(config.origin + '/api/gala/order',
  { method, headers: { cookie, ...(origin ? { origin } : {}) } });

test('live buyer access needs no shared code and preserves an existing owner across pages', () => {
  const first = liveCustomerSession(request('', 'POST'), config, now);
  const cookie = `${LIVE_CUSTOMER_COOKIE}=${first}`;
  const identity = authorizeLiveCustomer(request(cookie), config, now);
  assert.equal(identity.length, 64);
  assert.equal(liveCustomerSession(request(cookie, 'POST'), config, now), first);
  assert.equal(authorizeLiveCustomer(request(cookie, 'POST'), config, now), identity);
  assert.notEqual(customerIdentity(liveCustomerSession(request('', 'POST'), config, now), config.key, now, 'live'), identity);
  assert.throws(() => authorizeLiveCustomer(request(cookie, 'POST', 'https://other.example'), config, now));
  assert.throws(() => authorizeLiveCustomer(request(cookie, 'POST', ''), config, now));
  assert.throws(() => liveCustomerSession(request(cookie), config, now));
  assert.throws(() => authorizeLiveCustomer(request(cookie), config, now + 24*3600_000));
});

test('test, buyer, legacy dues and live-admin sessions cannot substitute for one another', () => {
  const testAdmin = createAdminSession(config.key, config.password, now);
  const testBuyer = createCustomerSession(config.key, now);
  const admin = createLiveAdminSession(config, now), buyer = liveCustomerSession(request('', 'POST'), config, now);
  assert(!validAdminSession(admin, config.key, config.password, now));
  assert.throws(() => customerIdentity(buyer, config.key, now));
  assert.throws(() => authorizeLiveAdmin(request(`${LIVE_ADMIN_COOKIE}=${testAdmin}`), config, now));
  assert.throws(() => authorizeLiveAdmin(request(`${LIVE_ADMIN_COOKIE}=${buyer}`), config, now));
  assert.throws(() => authorizeLiveCustomer(request(`${LIVE_CUSTOMER_COOKIE}=${testBuyer}`), config, now));
  assert.throws(() => authorizeLiveCustomer(request(`${LIVE_CUSTOMER_COOKIE}=${admin}`), config, now));
  assert.throws(() => authorizeLiveAdmin(request(`admin_session=${admin}`), config, now));
  assert.throws(() => authorizeLiveAdmin(request(`osg_test_admin_session=${testAdmin}`), config, now));
});

test('shared live admin expires, rotates with the password, and rejects cross-origin mutations', () => {
  const cookie = `${LIVE_ADMIN_COOKIE}=${createLiveAdminSession(config, now)}`;
  assert.doesNotThrow(() => authorizeLiveAdmin(request(cookie), config, now));
  assert.doesNotThrow(() => authorizeLiveAdmin(request(cookie, 'POST'), config, now));
  assert.throws(() => authorizeLiveAdmin(request(cookie), config, now + 8*3600_000));
  assert.throws(() => authorizeLiveAdmin(request(cookie), { ...config, password: 'changed' }, now));
  assert.throws(() => authorizeLiveAdmin(request(cookie), { ...config, key: 'b'.repeat(64) }, now));
  assert.throws(() => authorizeLiveAdmin(request(cookie, 'POST', 'https://other.example'), config, now));
  for (const patch of [{ origin: 'http://gala.example' }, { origin: config.origin + '/path' }, { key: '' }, { password: '' }])
    assert.throws(() => createLiveAdminSession({ ...config, ...patch }, now));
  for (const options of [liveAdminCookieOptions, liveCustomerCookieOptions]) {
    assert.equal(options.secure, true); assert.equal(options.httpOnly, true); assert.equal(options.path, '/');
    assert.equal(options.sameSite, 'lax'); assert.equal(options.domain, undefined);
  }
});

test('database adapter rejects missing or cross-environment markers and recognizes intentional sales closure', async () => {
  for (const mode of ['sandbox', 'live']) {
    const expected = mode === 'live' ? 'osg-gala-production' : 'osg-gala-development';
    for (const name of [expected, 'unrelated', null, mode === 'live' ? 'osg-gala-development' : 'osg-gala-production']) {
      const store = new SupabaseOrderStore('https://offline.supabase.co', 'sb_secret_offline', async () =>
        Response.json({ name }));
      if (name === expected) await store.verifyEnvironment(mode);
      else await assert.rejects(store.verifyEnvironment(mode), /does not match/);
    }
  }
  const store = new SupabaseOrderStore('https://offline.supabase.co', 'sb_secret_offline', async () =>
    Response.json({ code: 'P0001', message: 'Gala submissions are closed' }, { status: 400 }));
  await assert.rejects(store.reserve(priceRequest({ requestId: 'a1dc2b94-151a-4b52-bbb5-2c855c7f4d17', kind: 'tables', allSalesFinal: true,
    contact: { name: 'Offline Buyer', email: 'offline@example.com', phone: '4325550100' }, purchase: { product: 'silver', quantity: 1, extraSeats: 0 } })), GalaSalesClosed);
});
