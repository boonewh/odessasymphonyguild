import test from 'node:test';
import assert from 'node:assert/strict';
import { quotePurchase, quoteGifts, remainingTables, transitionDemoOrder, previewAllowed, purchaseSchema, recipientsSchema } from '../lib/gala/model.ts';

test('flyer table prices and up to two additional seats use exact cents', () => {
  for (const [product, total] of [['platinum', 687500], ['gold', 437500], ['silver', 250000]]) {
    assert.deepEqual(quotePurchase({ product, quantity: 1, extraSeats: 2 }).total, total);
    assert.equal(quotePurchase({ product, quantity: 1, extraSeats: 2 }).seats, 10);
    assert.equal(quotePurchase({ product, quantity: 1, extraSeats: 0 }).seats, 8);
  }
});
test('couples purchases count two adults; student date purchases count one student', () => {
  assert.equal(quotePurchase({ product: 'couples', quantity: 2, extraSeats: 0 }).total, 60000);
  assert.equal(quotePurchase({ product: 'couples', quantity: 2, extraSeats: 0 }).seats, 4);
  assert.equal(quotePurchase({ product: 'student-date', quantity: 3, extraSeats: 0 }).total, 30000);
});
test('invalid quantities, unsupported extra seats and multiple-table orders are rejected', () => {
  for (const purchase of [
    { product: 'gold', quantity: 2, extraSeats: 0 }, { product: 'gold', quantity: 1, extraSeats: 3 },
    { product: 'couples', quantity: 1, extraSeats: 1 }, { product: 'couples', quantity: 0.5, extraSeats: 0 },
    { product: 'student-date', quantity: -1, extraSeats: 0 },
  ]) assert.equal(purchaseSchema.safeParse(purchase).success, false);
});
test('multi-student gift total preserves quantities and rejects empty recipients', () => {
  assert.equal(quoteGifts([{ student:'Sample A', grade:'9', roses:2, cookies:1 }, { student:'Sample B', grade:'12', roses:0, cookies:2 }]), 5000);
  assert.throws(() => quoteGifts([{ student:'Sample A', grade:'9', roses:0, cookies:0 }]));
  assert.throws(() => quoteGifts([{ student:'Sample A', grade:'9', roses:0.5, cookies:0 }]));
});
const held = { id:'test', demo:true, kind:'tables', status:'awaiting_payment', purchase:{product:'gold',quantity:1,extraSeats:2} };
test('held and paid tables consume capacity; verified simulated expiry releases it', () => {
  assert.equal(remainingTables([held], 'gold'), 19);
  assert.equal(remainingTables([transitionDemoOrder(held, 'paid')], 'gold'), 19);
  assert.equal(remainingTables([transitionDemoOrder(held, 'expired')], 'gold'), 20);
  assert.equal(remainingTables([held], 'silver'), 20);
});
test('paid and expired records cannot be reprocessed or turned into one another', () => {
  assert.throws(() => transitionDemoOrder(transitionDemoOrder(held, 'paid'), 'expired'));
  assert.throws(() => transitionDemoOrder(transitionDemoOrder(held, 'expired'), 'paid'));
  assert.throws(() => transitionDemoOrder(transitionDemoOrder(held, 'paid'), 'paid'));
  assert.throws(() => transitionDemoOrder(held, 'mailed'));
});
test('invitation requests require preparation before mailing', () => {
  const invite = { ...held, kind:'invitations', status:'requested' };
  assert.throws(() => transitionDemoOrder(invite, 'mailed'));
  assert.equal(transitionDemoOrder(transitionDemoOrder(invite, 'prepared'), 'mailed').status, 'mailed');
  assert.equal(recipientsSchema.safeParse([]).success, false);
});
test('local preview is inaccessible in production, hosted previews, and test environments', () => {
  assert.equal(previewAllowed('development'), true);
  for (const [nodeEnv, vercelEnv] of [['production', undefined], ['production', 'production'], ['development', 'preview'], ['development', 'production'], ['test', undefined], [undefined, undefined]]) {
    assert.equal(previewAllowed(nodeEnv, vercelEnv), false);
  }
});
