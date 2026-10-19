import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { buildLedger, filterLedger, ledgerFilterSchema, ledgerCsv, ledgerSummaryCsv, ledgerProductTotals, ledgerDate } from '../lib/gala/ledger.ts';
import { ledgerReport } from '../lib/gala/backend/ledger.ts';
import { priceRequest } from '../lib/gala/backend/domain.ts';
import { testDatabase } from './helpers/gala-database.mjs';
import { boardReviewRequest } from '../lib/gala/board-review.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const contact = { name: 'Ledger Test Buyer', email: 'ledger@example.com', phone: '4325550101' };
const purchase = (product = 'gold', extraSeats = 0, quantity = 1) => ({ product, extraSeats, quantity });
function order(details = { kind: 'cart', purchases: [purchase('gold', 2), purchase('student-date')], gifts: [{ student: 'Sample Student', grade: '12', roses: 2, cookies: 1 }] }, status = 'paid') {
  const id = randomUUID(), priced = priceRequest({ ...details, requestId: id, contact, allSalesFinal: true });
  return { id, details: priced.details, amount: priced.amount, currency: 'usd', status, created_at: '2026-10-13T02:00:00Z',
    confirmed_at: status === 'paid' ? '2026-10-13T02:05:00Z' : null,
    stripe_session_id: status === 'reserved' ? null : 'cs_test_' + id, payment_intent_id: status === 'paid' ? 'pi_' + id : null };
}
const pendingJob = o => ({ order_id: o.id, status: 'pending', dispatched_at: null, receipt_id: null, realm_id: null });
const snapshot = orders => ({ orders, accounting: orders.filter(o => o.status === 'paid').map(pendingJob) });

test('mixed cart separates table, extra seats, tickets and each student gift without duplicating order revenue', () => {
  const o = order(), report = ledgerReport(snapshot([o]));
  assert.equal(report.paidAmount, 450500); assert.equal(report.paidOrderCount, 1);
  assert.deepEqual(Object.fromEntries(report.lines.map(l => [l.product, [l.quantity, l.unitAmount, l.amount]])), {
    cookies: [1, 1000, 1000], rose: [2, 1000, 2000], gold: [1, 350000, 350000], 'gold-extra': [2, 43750, 87500], 'student-date': [1, 10000, 10000],
  });
  assert.equal(report.lines.filter(l => l.student === 'Sample Student').length, 2);
  assert.deepEqual(report.preview.orderIds, [o.id]); assert.equal(report.preview.canSend, false);
  assert.equal(report.preview.account, 'Symphony Ball Revenue');
});

test('historical line prices reconcile all current table and ticket variations and legacy gift orders', () => {
  const orders = [];
  for (const tier of ['platinum', 'gold', 'silver']) for (const extra of [0, 1, 2])
    orders.push(order({ kind: 'tables', purchase: purchase(tier, extra) }));
  for (const product of ['couples', 'student-date']) for (const quantity of [1, 10])
    orders.push(order({ kind: 'tables', purchase: purchase(product, 0, quantity) }));
  orders.push(order({ kind: 'gifts', gifts: [{ student: 'Student One', grade: '9', roses: 0, cookies: 50 }, { student: 'Student Two', grade: '10', roses: 50, cookies: 0 }] }));
  const ledger = buildLedger(snapshot(orders));
  assert.equal(ledger.paidAmount, orders.reduce((sum, o) => sum + o.amount, 0));
  assert.equal(ledgerProductTotals(ledger.lines).reduce((sum, i) => sum + i.amount, 0), ledger.paidAmount);
  assert.equal(new Set(ledger.lines.map(l => l.id)).size, ledger.lines.length);
});

test('unpaid reservations and expired checkouts never contribute to paid summaries or final preview', () => {
  const paid = order(), unpaid = order(undefined, 'awaiting_payment'), reserved = order(undefined, 'reserved'), expired = order(undefined, 'expired');
  const report = ledgerReport(snapshot([paid, unpaid, reserved, expired]));
  assert.equal(report.paidAmount, paid.amount); assert.equal(report.pendingAmount, unpaid.amount + reserved.amount);
  assert.equal(report.expiredAmount, expired.amount); assert.equal(report.pendingOrderCount, 2);
  assert.deepEqual(report.preview.orderIds, [paid.id]);
  assert.equal(ledgerProductTotals(report.lines).reduce((sum, i) => sum + i.amount, 0), paid.amount);
  assert.match(report.preview.reasons.join(' '), /await payment/);
});

test('amount mismatch, missing payment evidence, duplicate sources and unexpected prices fail the whole report closed', () => {
  for (const patch of [{ amount: 1 }, { payment_intent_id: null }, { stripe_session_id: 'cs_live_fake' }, { confirmed_at: null }, { currency: 'eur' }]) {
    const o = { ...order(), ...patch }; assert.throws(() => buildLedger(snapshot([o])));
  }
  const first = order(), duplicatePayment = { ...order(), payment_intent_id: first.payment_intent_id };
  assert.throws(() => buildLedger(snapshot([first, first])));
  assert.throws(() => buildLedger(snapshot([first, duplicatePayment])));
  const raw = snapshot([first]); raw.accounting.push(raw.accounting[0]); assert.throws(() => buildLedger(raw));
  assert.throws(() => buildLedger({ orders: [], accounting: [pendingJob(first)] }));
});

test('known, dispatched and uncertain accounting history is retained and blocks any assumption of a fresh final posting', () => {
  const missing = ledgerReport({ orders: [order()], accounting: [] });
  assert.equal(missing.history[0].status, 'missing'); assert.equal(missing.preview.canSend, false);
  for (const patch of [{ status: 'synced', receipt_id: '145', realm_id: '123' }, { dispatched_at: '2026-10-13T02:06:00Z' },
    { status: 'review' }, { status: 'processing' }, { realm_id: '123' }]) {
    const o = order(), raw = snapshot([o]); Object.assign(raw.accounting[0], patch);
    const report = ledgerReport(raw);
    assert.equal(report.history.length, 1); assert.equal(report.paidAmount, o.amount);
    assert.equal(report.preview.canSend, false); assert.match(report.preview.reasons.join(' '), /Resolve that history/);
  }
});

test('review identity is stable across reads and source order but changes with paid contents or accounting history', () => {
  const one = order(), two = order(), raw = snapshot([one, two]);
  const original = ledgerReport(raw, '2026-10-13T00:00:00Z').preview.revision;
  assert.equal(ledgerReport(snapshot([two, one]), '2026-10-14T00:00:00Z').preview.revision, original);
  assert.equal(ledgerReport(snapshot([one, two, order(undefined, 'reserved')])).preview.revision, original);
  assert.notEqual(ledgerReport(snapshot([one])).preview.revision, original);
  raw.accounting[0].status = 'review'; assert.notEqual(ledgerReport(raw).preview.revision, original);
});

test('search, product and inclusive Central-time dates filter lines; all-status exports label unpaid items', () => {
  const o = order(), unpaid = order(undefined, 'expired'), lines = buildLedger(snapshot([o, unpaid])).lines;
  assert.equal(ledgerDate(o.created_at), '2026-10-12');
  assert.equal(filterLedger(lines, ledgerFilterSchema.parse({ product: 'rose', query: 'student', from: '2026-10-12', to: '2026-10-12' })).length, 1);
  assert.equal(filterLedger(lines, ledgerFilterSchema.parse({ from: '2026-10-13' })).length, 0);
  assert.equal(filterLedger(lines, ledgerFilterSchema.parse({ status: 'expired' })).length, 5);
  assert.equal(filterLedger(lines, ledgerFilterSchema.parse({ query: o.payment_intent_id })).length, 5);
  assert.equal(ledgerFilterSchema.safeParse({ from: '2026-10-14', to: '2026-10-13' }).success, false);
  assert.equal(ledgerFilterSchema.safeParse({ from: '2026-02-30' }).success, false);
  assert.match(ledgerCsv(lines), /Closed without payment/);
  assert.match(ledgerSummaryCsv(lines), /"Total paid sales","","4505.00"/);
});

test('CSV protects formula-like buyer/student content and preserves commas, quotes, newlines and cents', () => {
  const o = order(); o.details.contact.name = '=SUM(1,2)'; o.details.gifts[0].student = '+Danger,"Student"\nSecond line';
  const csv = ledgerCsv(buildLedger(snapshot([o])).lines);
  assert.ok(csv.startsWith('\uFEFF')); assert.match(csv, /"'=SUM\(1,2\)"/);
  assert.ok(csv.includes('"\'+Danger,""Student""\nSecond line"')); assert.match(csv, /"437.50","875.00"/);
  assert.equal(ledgerSummaryCsv([]).includes('"Total paid sales","","0.00"'), true);
});

test('snapshot migration is read-only, complete past dashboard/API limits and private to the server', async t => {
  const { db, store } = await testDatabase(); t.after(() => db.close());
  const folder = new URL('../supabase/gala-development/', import.meta.url);
  for (const file of (await readdir(folder)).filter(n => /^0\d\d_.*\.sql$/.test(n) && !n.startsWith('001_') && !n.startsWith('012_')).sort())
    await db.exec(await readFile(new URL(file, folder), 'utf8'));
  const first = order({ kind: 'tables', purchase: purchase('student-date') });
  await store.reserve(priceRequest(first.details)); await store.apply(first.id, first.stripe_session_id, 'paid', first.payment_intent_id, 'evt_test');
  const before = (await db.query('select * from gala_orders')).rows;
  await db.exec(await readFile(new URL('012_gala_ledger.sql', folder), 'utf8'));
  assert.deepEqual((await db.query('select * from gala_orders')).rows, before);
  const rpc = async () => (await db.query('select gala_ledger_snapshot() as value')).rows[0].value;
  const report = ledgerReport(await rpc()); assert.equal(report.paidAmount, first.amount); assert.ok(report.lines[0].confirmedAt);
  // Seed unpaid fixture rows in disposable SQL, beyond both common list limits.
  await db.query(`with fixtures as materialized (select gen_random_uuid() as id from generate_series(1,1005))
    insert into gala_orders(id,request_hash,details,amount,description,status)
    select id, 'fixture', jsonb_set($1::jsonb,'{requestId}',to_jsonb(id::text)),10000,'Fixture','reserved'
    from fixtures`, [JSON.stringify(first.details)]);
  const all = ledgerReport(await rpc()); assert.equal(all.pendingOrderCount, 1005); assert.equal(all.lines.length, 1006);
  for (const role of ['anon', 'authenticated']) {
    await db.exec('set role ' + role); await assert.rejects(rpc()); await db.exec('reset role');
  }
  await db.exec('set role service_role'); assert.equal((await rpc()).orders.length, 1006); await db.exec('reset role');
  const inventory = (await db.query('select * from gala_inventory')).rows;
  assert.ok(inventory.every(i => i.capacity === 20 && i.board_confirmed === false));
});

test('board ledger is read-only and the retired per-order sender remains inaccessible', () => {
  assert.equal(boardReviewRequest('/api/gala/ledger', 'GET'), 'allowed');
  for (const method of ['POST', 'PATCH', 'DELETE']) assert.equal(boardReviewRequest('/api/gala/ledger', method), 'blocked');
  assert.equal(boardReviewRequest('/api/gala/quickbooks/sync', 'POST'), 'blocked');
});

test('actual ledger route handlers enforce accounting permissions, safe downloads and retired sending', async () => {
  const result = await promisify(execFile)(process.execPath, ['--conditions=react-server', '--import', 'tsx',
    fileURLToPath(new URL('./helpers/gala-ledger-route.mts', import.meta.url))], { timeout: 30000, windowsHide: true });
  assert.match(result.stdout, /verified with fake transport/);
});

test('historical closed-order receipts survive a sandbox change without bypassing pending verification', async () => {
  const result = await promisify(execFile)(process.execPath, ['--conditions=react-server', '--import', 'tsx',
    fileURLToPath(new URL('./helpers/gala-closed-order-route.mts', import.meta.url))], { timeout: 30000, windowsHide: true });
  assert.match(result.stdout, /Closed historical orders preserved/);
});
