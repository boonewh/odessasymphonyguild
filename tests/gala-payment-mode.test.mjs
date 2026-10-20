import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { paymentEnvironment, verifyStripeAccount } from '../lib/gala/backend/payment-mode.ts';
import { readBackendConfig, backendEnabled, DEVELOPMENT_SUPABASE_URL } from '../lib/gala/backend/config.ts';
import { priceRequest } from '../lib/gala/backend/domain.ts';
import { sessionParameters, startCheckout, verifySession, reconcileSession, reconcilePending } from '../lib/gala/backend/checkout.ts';
import { parseWebhook, reconcileCheckoutEvent } from '../lib/gala/backend/webhook.ts';
import { recoveryPass } from '../lib/gala/backend/recovery.ts';

// Offline fixtures: no network, credentials, database writes or real charges.
function fixture(mode = 'live') {
  const input = { requestId: randomUUID(), kind: 'cart', allSalesFinal: true,
    contact: { name: 'Fixture Buyer', email: 'fixture@example.com', phone: '4325550100' },
    purchases: [{ product: 'silver', quantity: 1, extraSeats: 0 }, { product: 'student-date', quantity: 1, extraSeats: 0 }],
    gifts: [{ student: 'Fixture Student', grade: '12', roses: 1, cookies: 1 }] };
  const quote = priceRequest(input), environment = paymentEnvironment(mode);
  const order = { id: input.requestId, request_hash: quote.hash, details: input, amount: quote.amount,
    currency: 'usd', description: quote.description, tier: null, status: 'reserved',
    created_at: new Date().toISOString(), stripe_session_id: null, payment_intent_id: null };
  const params = sessionParameters(order, 'https://gala.example', mode);
  const session = { id: `cs_${mode === 'live' ? 'live' : 'test'}_fixture`, livemode: environment.livemode,
    mode: 'payment', currency: 'usd', amount_total: order.amount, client_reference_id: order.id,
    metadata: params.metadata, recovered_from: null, status: 'open', payment_status: 'unpaid',
    payment_intent: null, url: 'https://checkout.stripe.com/fixture' };
  const payment = { id: 'pi_fixture', livemode: environment.livemode, currency: 'usd', amount: order.amount,
    amount_received: order.amount, metadata: params.payment_intent_data.metadata, status: 'succeeded' };
  let creates = 0, writes = 0, expires = 0, gets = 0;
  const store = {
    reserve: async () => order, get: async () => { gets++; return order; }, pending: async () => [order],
    bind: async (_id, id) => { order.stripe_session_id = id; order.status = 'awaiting_payment'; return order; },
    apply: async (_id, _session, state, paymentId) => { writes++; order.status = state; order.payment_intent_id = paymentId; return order; },
  };
  const stripe = { checkout: { sessions: {
    create: async actual => { creates++; assert.deepEqual(actual, params); return session; },
    retrieve: async () => session,
    expire: async () => { expires++; session.status = 'expired'; return session; },
  } }, paymentIntents: { retrieve: async () => payment } };
  return { input, order, session, payment, store, stripe, params,
    counters: () => ({ creates, writes, expires, gets }),
    paid: () => Object.assign(session, { status: 'complete', payment_status: 'paid', payment_intent: payment.id }) };
}

test('each payment environment is pinned to OSG and test configuration cannot select live mode', () => {
  for (const mode of ['sandbox', 'live']) {
    assert.doesNotThrow(() => verifyStripeAccount(paymentEnvironment(mode).account, mode));
    assert.throws(() => verifyStripeAccount(paymentEnvironment(mode === 'live' ? 'sandbox' : 'live').account, mode));
    assert.throws(() => verifyStripeAccount('acct_unrelated', mode));
  }
  assert.throws(() => paymentEnvironment('automatic'));
  const env = { NODE_ENV: 'development', GALA_BACKEND_ENABLED: 'true', GALA_STRIPE_SECRET_KEY: 'sk_test_fixture',
    GALA_SUPABASE_URL: DEVELOPMENT_SUPABASE_URL, GALA_SUPABASE_SECRET_KEY: 'sb_secret_fixture',
    GALA_STRIPE_WEBHOOK_SECRET: 'whsec_fixture', GALA_DEVELOPMENT_TOKEN: 'a'.repeat(64),
    GALA_PAYMENT_MODE: 'live', GALA_LIVE_ENABLED: 'true' };
  assert.equal(readBackendConfig(env).paymentMode, 'sandbox');
  assert.throws(() => readBackendConfig({ ...env, GALA_STRIPE_SECRET_KEY: 'sk_live_fixture' }));
  const liveEnv = { ...env, NODE_ENV: 'production', VERCEL_ENV: 'production' };
  assert.equal(backendEnabled(liveEnv), true);
  assert.throws(() => readBackendConfig(liveEnv), /live HTTPS origin/);
});

test('existing sandbox payload stays identical; future live payload changes only payment identity', () => {
  const c = fixture('sandbox');
  assert.deepEqual(sessionParameters(c.order, 'https://gala.example'), c.params);
  const live = sessionParameters(c.order, 'https://gala.example', 'live');
  const normalized = structuredClone(live);
  normalized.metadata.application = c.params.metadata.application;
  normalized.payment_intent_data.metadata.application = c.params.payment_intent_data.metadata.application;
  assert.deepEqual(normalized, c.params);
  assert.equal(live.metadata.application, 'osg-gala-2027');
  assert.equal(live.payment_intent_data.metadata.application, 'osg-gala-2027');
  assert.equal(live.line_items.reduce((sum, line) => sum + line.price_data.unit_amount, 0), 212000);
  assert.deepEqual(live.allowed_payment_method_types, ['card']);
  assert.equal(live.after_expiration.recovery.enabled, false);
  assert.equal(live.expires_at, Math.floor(Date.parse(c.order.created_at) / 1000) + 35 * 60);
});

test('offline live checkout create/resume and verified paid settlement use the selected identity', async () => {
  const c = fixture();
  await startCheckout(c.store, c.stripe, c.input, 'https://gala.example', Date.now(), 'live');
  await startCheckout(c.store, c.stripe, c.input, 'https://gala.example', Date.now(), 'live');
  assert.equal(c.counters().creates, 1);
  c.paid();
  assert.equal(await reconcileCheckoutEvent(c.store, c.stripe,
    { type: 'checkout.session.completed', id: 'evt_fixture', data: { object: { id: c.session.id } } }, 'live'), 'paid');
  assert.equal(c.order.status, 'paid');
  assert.equal(c.order.payment_intent_id, 'pi_fixture');
});

test('cross-environment sessions, metadata and payment intents never settle an order', async () => {
  for (const mode of ['sandbox', 'live']) {
    const other = mode === 'live' ? 'sandbox' : 'live';
    const c = fixture(mode); c.paid();
    assert.throws(() => verifySession(c.order, c.session, other));
    assert.equal(await reconcileSession(c.store, c.stripe, c.session.id, 'evt_cross', other), 'unrelated');
    assert.equal(c.counters().gets, 0);
    for (const patch of [{ livemode: !c.session.livemode }, { livemode: undefined }, { amount_total: 1 },
      { currency: 'eur' }, { client_reference_id: randomUUID() }, { recovered_from: 'cs_other' }]) {
      const original = { ...c.session }; Object.assign(c.session, patch);
      await assert.rejects(reconcileSession(c.store, c.stripe, c.session.id, 'evt_bad', mode));
      Object.assign(c.session, original);
    }
    for (const patch of [{ livemode: !c.payment.livemode }, { livemode: undefined }, { amount_received: 1 },
      { metadata: { ...c.payment.metadata, application: paymentEnvironment(other).application } },
      { metadata: { ...c.payment.metadata, gala_order_id: randomUUID() } }]) {
      const original = { ...c.payment }; Object.assign(c.payment, patch);
      await assert.rejects(reconcileSession(c.store, c.stripe, c.session.id, 'evt_bad_payment', mode));
      Object.assign(c.payment, original);
    }
    assert.equal(c.counters().writes, 0);
  }
});

test('signed webhook validation requires the selected mode and rejects tampering and connected accounts', () => {
  const sdk = new Stripe('sk_test_offline_fixture'), secret = 'whsec_offline_fixture';
  for (const mode of ['sandbox', 'live']) {
    const event = { id: 'evt_fixture', livemode: paymentEnvironment(mode).livemode, type: 'checkout.session.completed', data: { object: {} } };
    const parse = (patch = {}, selected = mode) => {
      const body = JSON.stringify({ ...event, ...patch });
      return parseWebhook(sdk, body, sdk.webhooks.generateTestHeaderString({ payload: body, secret }), secret, selected);
    };
    assert.equal(parse().id, 'evt_fixture');
    assert.throws(() => parse({}, mode === 'live' ? 'sandbox' : 'live'));
    assert.throws(() => parse({ livemode: undefined }));
    assert.throws(() => parse({ account: 'acct_other' }));
    const body = JSON.stringify(event), signature = sdk.webhooks.generateTestHeaderString({ payload: body, secret });
    assert.throws(() => parseWebhook(sdk, body + ' ', signature, secret, mode));
  }
});

test('live-mode recovery confirms expiration and protects uncertain or mismatched payments', async () => {
  const c = fixture(); c.order.stripe_session_id = c.session.id;
  c.order.created_at = new Date(Date.now() - 36 * 60_000).toISOString();
  let claimed = false, outcome;
  await recoveryPass({ claim: async () => claimed ? null : (claimed = true, c.order),
    finish: async (_id, _token, state) => { outcome = state; } }, c.store, c.stripe, 2, Infinity, 'live');
  assert.equal(outcome, 'expired'); assert.equal(c.counters().expires, 1); assert.equal(c.counters().writes, 1);
  for (const patch of [{ livemode: false, status: 'canceled', amount_received: 0 }, { status: 'processing' }]) {
    const pending = fixture(); pending.session.status = 'expired'; pending.session.payment_intent = pending.payment.id;
    Object.assign(pending.payment, patch);
    assert.equal(await reconcileSession(pending.store, pending.stripe, pending.session.id, 'evt_expiry', 'live'), 'pending');
    assert.equal(pending.counters().writes, 0);
  }
  const canceled = fixture(); canceled.session.status = 'expired'; canceled.session.payment_intent = canceled.payment.id;
  Object.assign(canceled.payment, { status: 'canceled', amount_received: 1 });
  await assert.rejects(reconcileSession(canceled.store, canceled.stripe, canceled.session.id, 'evt_bad_cancel', 'live'), /requires review/);
  assert.equal(canceled.counters().writes, 0);
  canceled.payment.amount_received = 0;
  assert.equal(await reconcileSession(canceled.store, canceled.stripe, canceled.session.id, 'evt_cancel', 'live'), 'expired');
  const paid = fixture(); paid.order.stripe_session_id = paid.session.id; paid.paid();
  const results = await reconcilePending(paid.store, paid.stripe, Date.now(), 'live');
  assert.equal(results[0].state, 'paid');
});
