import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readAttempt, checkoutUrl } from '../lib/gala/checkout-attempt.ts';
import { priceRequest } from '../lib/gala/backend/domain.ts';
import { sessionParameters } from '../lib/gala/backend/checkout.ts';

test('saved flyer retries preserve the exact order ID, selections and multi-student gifts', () => {
  const request = { requestId: randomUUID(), kind: 'gifts', allSalesFinal: true,
    contact: { name: 'Fictional Buyer', email: 'test@example.com', phone: '4325550100' },
    gifts: [{ student: 'Student One', grade: '9', roses: 2, cookies: 1 }, { student: 'Student Two', grade: '12', roses: 1, cookies: 2 }] };
  assert.deepEqual(readAttempt(JSON.stringify(request)), request);
  assert.equal(priceRequest(readAttempt(JSON.stringify(request))).amount, 6000);
  assert.equal(readAttempt(null), null);
  for (const invalid of ['invalid-json', '{}', JSON.stringify({ ...request, requestId: 'bad' }),
    JSON.stringify({ ...request, allSalesFinal: false }), JSON.stringify({ ...request, amount: 1 })])
    assert.throws(() => readAttempt(invalid));
});
test('checkout redirects accept only Stripe hosted HTTPS destinations', () => {
  assert.equal(checkoutUrl('https://checkout.stripe.com/c/pay/cs_test_123'), 'https://checkout.stripe.com/c/pay/cs_test_123');
  for (const url of ['javascript:alert(1)', 'http://checkout.stripe.com', 'https://checkout.stripe.com.evil.test',
    'https://checkout.stripe.com@evil.test', 'https://user:password@checkout.stripe.com', '/relative', null])
    assert.throws(() => checkoutUrl(url));
});
test('Stripe return URLs identify the saved order without declaring it paid', () => {
  const id = randomUUID();
  const parameters = sessionParameters({ id, amount: 250000, description: 'Silver plus two seats', created_at: new Date().toISOString(),
    details: { contact: { email: 'test@example.com' } } }, 'http://localhost:3000');
  for (const value of [parameters.success_url, parameters.cancel_url]) {
    const url = new URL(value); assert.equal(url.searchParams.get('order_id'), id);
    assert.equal(url.pathname, '/gala/preview/payment'); assert.equal(url.searchParams.has('paid'), false);
  }
});
