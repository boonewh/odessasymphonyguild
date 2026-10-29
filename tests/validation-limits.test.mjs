import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutRequest } from '../lib/gala/checkout-request.ts';
import { recipientsSchema } from '../lib/gala/model.ts';
import { adminStudentSchema } from '../lib/validation/student.ts';

const contact = { name: 'Fictional Buyer', email: 'buyer@example.com', phone: '4325550123' };
const requestId = '11111111-1111-4111-8111-111111111111';

test('oversized invalid cart and invitation collections produce bounded validation errors', () => {
  const invalid = Array(10_000).fill(null);
  const cart = checkoutRequest.safeParse({ kind: 'cart', requestId, contact, allSalesFinal: true,
    purchases: invalid, gifts: invalid });
  assert.equal(cart.success, false);
  assert.deepEqual(cart.error.issues.map(issue => [issue.path, issue.code]), [
    [['purchases'], 'too_big'], [['gifts'], 'too_big'],
  ]);
  const invitations = recipientsSchema.safeParse(invalid);
  assert.equal(invitations.success, false);
  assert.equal(invitations.error.issues.length, 1);
  assert.equal(invitations.error.issues[0].code, 'too_big');
});

test('membership guardians reject oversized invalid arrays before expanding element errors', () => {
  const result = adminStudentSchema.safeParse({ guardians: Array(10_000).fill(null) });
  assert.equal(result.success, false);
  const guardianIssues = result.error.issues.filter(issue => issue.path[0] === 'guardians');
  assert.equal(guardianIssues.length, 1);
  assert.equal(guardianIssues[0].code, 'too_big');
});

test('ordinary checkout values and per-item errors retain the existing payment limits', () => {
  const cart = { kind: 'cart', requestId, contact, allSalesFinal: true,
    purchases: [{ product: 'silver', quantity: 1, extraSeats: 0 }], gifts: [] };
  assert.equal(checkoutRequest.safeParse(cart).success, true);
  assert.equal(checkoutRequest.safeParse({ ...cart, purchases: Array(10).fill(cart.purchases[0]) }).success, true);
  assert.equal(checkoutRequest.safeParse({ ...cart, purchases: Array(11).fill(cart.purchases[0]) }).success, false);
  const invalid = checkoutRequest.safeParse({ ...cart, purchases: [{ ...cart.purchases[0], quantity: 0 }] });
  assert.equal(invalid.success, false);
  assert.ok(invalid.error.issues.some(issue => issue.path.join('.') === 'purchases.0.quantity'));
});
