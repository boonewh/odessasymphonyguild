import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { finalDatabase } from './helpers/gala-final-database.mjs';
import { priceRequest } from '../lib/gala/backend/domain.ts';
import { ledgerReport } from '../lib/gala/backend/ledger.ts';
import { sessionParameters } from '../lib/gala/backend/checkout.ts';

const migration = new URL('../supabase/gala-development/014_gala_unlimited_manual_accounting.sql', import.meta.url);
const input = (tiers = ['silver']) => ({ requestId: randomUUID(), kind: 'cart', allSalesFinal: true,
  contact: { name: 'Unlimited Test Buyer', email: 'unlimited@example.com', phone: '4325550100' },
  purchases: tiers.map(product => ({ product, quantity: 1, extraSeats: 0 })), gifts: [] });
async function setup(t, before) {
  const c = await finalDatabase(); t.after(() => c.db.close());
  if (before) await before(c);
  await c.db.exec(await readFile(migration, 'utf8'));
  return { ...c, reserve: (tiers) => c.store.reserve(priceRequest(input(tiers))) };
}
const settle = (c, order, state) => c.store.apply(order.id, 'cs_test_' + order.id, state,
  state === 'paid' ? 'pi_' + order.id : null, 'evt_' + state + order.id);

test('unlimited tiers accept more than the former cap and preserve idempotency and paid counts', async t => {
  const c = await setup(t);
  const orders = await Promise.all(Array.from({ length: 25 }, () => c.reserve()));
  const q = priceRequest(orders[0].details); await c.store.reserve(q);
  assert.equal((await c.db.query('select * from gala_orders')).rows.length, 25);
  await settle(c, orders[0], 'paid'); await settle(c, orders[0], 'paid');
  const stock = (await c.rpc('gala_inventory_counts')).find(i => i.tier === 'silver');
  assert.equal(stock.capacity, null); assert.equal(stock.available, null); assert.equal(stock.unlimited, true);
  assert.equal(stock.board_confirmed, true); assert.equal(stock.paid, 1); assert.equal(stock.held, 24);
  assert.equal((await c.db.query('select * from gala_accounting_outbox')).rows.length, 0);
  const ledger = ledgerReport(await c.snapshot());
  assert.equal(ledger.paidAmount, 200000); assert.equal(ledger.pendingOrderCount, 24); assert.equal(ledger.history.length, 0);
});

test('finite caps still serialize buyers, roll back a mixed cart, and reopen only after verified expiry', async t => {
  const c = await setup(t);
  await c.db.exec("update gala_inventory set capacity=1 where tier='silver'");
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => c.reserve()));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const order = results.find(r => r.status === 'fulfilled').value;
  await c.db.query("update gala_orders set created_at=now()-interval '2 hours' where id=$1", [order.id]);
  await assert.rejects(c.reserve(['gold', 'silver']), /sold out/);
  assert.equal((await c.rpc('gala_inventory_counts')).find(i => i.tier === 'gold').held, 0);
  await settle(c, order, 'expired'); await c.reserve();
  assert.equal((await c.store.get(order.id)).status, 'expired');
});

test('switching unlimited to a lower limit retains paid/pending orders and blocks only new purchases', async t => {
  const c = await setup(t), paid = await c.reserve(), pending = await c.reserve();
  await settle(c, paid, 'paid');
  await c.db.exec("update gala_inventory set capacity=1 where tier='silver'");
  const stock = (await c.rpc('gala_inventory_counts')).find(i => i.tier === 'silver');
  assert.equal(stock.over_limit, true); assert.equal(stock.available, 0);
  await assert.rejects(c.reserve(), /sold out/);
  await settle(c, pending, 'paid'); // A previously issued checkout remains payable.
  assert.equal((await c.store.get(paid.id)).status, 'paid');
  assert.equal((await c.store.get(pending.id)).status, 'paid');
  await c.db.exec("update gala_inventory set capacity=null where tier='silver'");
  await c.reserve();
  await assert.rejects(c.db.exec("update gala_inventory set capacity=-1 where tier='silver'"));
});

test('unlimited checkouts still expire after 35 minutes and unpaid orders remain excluded from fulfillment and sales', async t => {
  const c = await setup(t), order = await c.reserve();
  const parameters = sessionParameters(order, 'http://localhost:3000');
  assert.equal(parameters.expires_at, Math.floor(new Date(order.created_at).getTime() / 1000) + 35 * 60);
  await assert.rejects(c.rpc('gala_assign_table_line', [order.id, 7, 0, 0]));
  await settle(c, order, 'expired');
  const ledger = ledgerReport(await c.snapshot());
  assert.equal(ledger.expiredOrderCount, 1); assert.equal(ledger.paidAmount, 0);
  assert.equal((await c.rpc('gala_assignment_list')).length, 0);
  await assert.rejects(settle(c, order, 'paid'), /Conflicting terminal/);
});

test('retirement preserves historical receipts and order data, removes tokens, and denies every accounting writer', async t => {
  let originalOrders, originalJobs;
  const c = await setup(t, async c => {
    const order = await c.store.reserve(priceRequest(input())); await settle(c, order, 'paid');
    await c.db.query("update gala_accounting_outbox set status='synced',receipt_id='145',realm_id='123'");
    await c.db.query("update gala_qb_connection set sealed_tokens='fictional-token'");
    originalOrders = (await c.db.query('select * from gala_orders')).rows;
    originalJobs = (await c.db.query('select * from gala_accounting_outbox')).rows;
  });
  assert.deepEqual((await c.db.query('select * from gala_orders')).rows, originalOrders);
  assert.deepEqual((await c.db.query('select * from gala_accounting_outbox')).rows, originalJobs);
  assert.equal((await c.db.query('select sealed_tokens from gala_qb_connection')).rows[0].sealed_tokens, null);
  assert.equal(ledgerReport(await c.snapshot()).history[0].receiptId, '145');
  await c.db.exec('set role service_role');
  await assert.rejects(c.rpc('gala_qb_lock', [randomUUID()]), /permission denied/);
  await assert.rejects(c.rpc('gala_final_claim', [randomUUID(), randomUUID()]), /permission denied/);
  await assert.rejects(c.rpc('gala_accounting_claim', [originalOrders[0].id, randomUUID()]), /permission denied/);
  const newOrder = await c.reserve(['gold']); await settle(c, newOrder, 'paid');
  assert.equal(ledgerReport(await c.snapshot()).paidOrderCount, 2);
  await c.db.exec('reset role');
  assert.equal((await c.db.query('select * from gala_accounting_outbox')).rows.length, 1);
});
