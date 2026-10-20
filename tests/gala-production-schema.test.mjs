import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { productionSchema } from '../scripts/gala-production-schema.mts';
import { priceRequest } from '../lib/gala/backend/domain.ts';
import { ledgerReport } from '../lib/gala/backend/ledger.ts';

const alice = 'a'.repeat(64), bob = 'b'.repeat(64);
const input = () => ({ requestId: randomUUID(), kind: 'cart', allSalesFinal: true,
  contact: { name: 'Offline Buyer', email: 'offline@example.com', phone: '4325550100' },
  purchases: [{ product: 'silver', quantity: 1, extraSeats: 0 }, { product: 'student-date', quantity: 1, extraSeats: 0 }],
  gifts: [{ student: 'Offline Student', grade: '12', roses: 1, cookies: 1 }] });
const invitation = () => ({ requestId: randomUUID(), contact: input().contact, recipients: [
  { name: 'Offline Guest', address: '123 Fictional St', address2: '', city: 'Odessa', state: 'TX', zip: '79761' }] });
async function setup(t, install = true) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  if (install) await db.exec(await productionSchema());
  const rpc = async (name, args = []) => (await db.query(`select ${name}(${args.map((_, i) => '$' + (i+1)).join(',')}) as value`, args)).rows[0].value;
  const reserve = (who = alice, q = priceRequest(input())) => rpc('gala_customer_reserve',
    [who, q.details.requestId, q.hash, JSON.stringify(q.details), q.amount, q.description, q.tier]);
  const open = () => db.exec('reset role; update gala_operating_state set sales_open=true,invitations_open=true; set role service_role;');
  return { db, rpc, reserve, open };
}

test('production installer is reproducible, empty, unlimited, private and closed by default', async t => {
  const sql = await productionSchema();
  assert.equal((await readFile(new URL('../supabase/gala-production/001_initial.sql', import.meta.url), 'utf8')).replace(/\r\n/g, '\n'), sql);
  assert.equal((sql.match(/^begin;$/gm) || []).length, 1); assert.equal((sql.match(/^commit;$/gm) || []).length, 1);
  assert.doesNotMatch(sql, /cs_test_|osg-gala-development|local-development-admin/);
  const { db, rpc } = await setup(t);
  assert.equal((await db.query('select name from gala_environment')).rows[0].name, 'osg-gala-production');
  assert.deepEqual((await db.query('select * from gala_operating_state')).rows, [{ id: 1, sales_open: false, invitations_open: false }]);
  for (const table of ['gala_orders','gala_order_tables','gala_invitation_requests','gala_invitation_recipients',
    'gala_staff','gala_staff_sessions','gala_payment_events','gala_accounting_outbox','gala_final_total','gala_payment_recovery']) {
    assert.equal((await db.query(`select count(*)::int as n from ${table}`)).rows[0].n, 0, table);
  }
  assert.equal((await db.query('select sealed_tokens from gala_qb_connection')).rows[0].sealed_tokens, null);
  for (const tier of await rpc('gala_inventory_counts')) {
    assert.equal(tier.capacity, null); assert.equal(tier.unlimited, true); assert.equal(tier.board_confirmed, true);
    assert.equal(tier.paid, 0); assert.equal(tier.held, 0);
  }
  assert.equal(ledgerReport(await rpc('gala_ledger_snapshot')).paidAmount, 0);
});

test('installer refuses existing databases and a repeated installation without overwriting data', async t => {
  const { db } = await setup(t, false);
  await db.exec("create table membership_fixture(id int); insert into membership_fixture values(7)");
  await assert.rejects(db.exec(await productionSchema()), /nonempty/); await db.exec('rollback');
  assert.equal((await db.query('select id from membership_fixture')).rows[0].id, 7);
  assert.equal((await db.query("select to_regclass('public.gala_orders') as name")).rows[0].name, null);
  await db.exec('drop table membership_fixture');
  await db.exec(await productionSchema());
  await assert.rejects(db.exec(await productionSchema()), /nonempty/); await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int as n from gala_inventory')).rows[0].n, 3);
});

test('an installation failure rolls back the complete schema instead of publishing partial permissions', async t => {
  const { db } = await setup(t, false);
  const sql = (await productionSchema()).replace(/commit;\s*$/, "select * from deliberately_missing_release_table;\ncommit;");
  await assert.rejects(db.exec(sql), /does not exist/); await db.exec('rollback');
  assert.equal((await db.query("select to_regclass('public.gala_environment') as name")).rows[0].name, null);
  await db.exec(await productionSchema());
  assert.equal((await db.query('select sales_open from gala_operating_state')).rows[0].sales_open, false);
});

test('new sales require explicit opening and ownership survives retries and rejects reassignment', async t => {
  const { db, rpc, reserve, open } = await setup(t);
  await db.exec('set role service_role');
  await assert.rejects(reserve(), /submissions are closed/);
  await open();
  const q = priceRequest(input()), order = await reserve(alice, q);
  await reserve(alice, q); await assert.rejects(reserve(bob, q), /Order unavailable/);
  assert.equal((await db.query('select customer_hash from gala_orders where id=$1', [order.id])).rows[0].customer_hash, alice);
  await assert.rejects(db.query('update gala_orders set customer_hash=$1 where id=$2', [bob, order.id]), /cannot change/);
  const unowned = priceRequest(input());
  await assert.rejects(rpc('gala_reserve', [unowned.details.requestId, unowned.hash, JSON.stringify(unowned.details), unowned.amount, unowned.description, null]), /ownership required/);
  assert.equal((await db.query('select count(*)::int as n from gala_orders')).rows[0].n, 1);
});

test('live session binding and settlement remain safe when new sales close; sandbox sessions are rejected', async t => {
  const { db, rpc, reserve, open } = await setup(t); await open();
  const paid = await reserve(), expired = await reserve();
  for (const id of ['cs_test_fixture','csXliveXfixture','cs_live_','cs_live_fixture-suffix']) {
    await assert.rejects(rpc('gala_bind_checkout', [paid.id, id]), /Live session required/);
    await assert.rejects(rpc('gala_apply_payment', [paid.id, id, 'paid', 'pi_fixture', 'evt_bad']), /Live session required/);
  }
  await rpc('gala_bind_checkout', [paid.id, 'cs_live_paidfixture']);
  await rpc('gala_bind_checkout', [expired.id, 'cs_live_expiredfixture']);
  await db.exec("update gala_orders set created_at=now()-interval '2 hours'");
  assert.equal((await rpc('gala_inventory_counts')).find(row => row.tier === 'silver').held, 2);
  await db.exec('reset role; update gala_operating_state set sales_open=false; set role service_role;');
  await assert.rejects(reserve(), /submissions are closed/);
  await rpc('gala_apply_payment', [paid.id, 'cs_live_paidfixture', 'paid', 'pi_fixture', 'evt_paid']);
  await rpc('gala_apply_payment', [paid.id, 'cs_live_paidfixture', 'paid', 'pi_fixture', 'evt_paid']);
  await rpc('gala_apply_payment', [expired.id, 'cs_live_expiredfixture', 'expired', null, 'evt_expired']);
  await assert.rejects(rpc('gala_apply_payment', [expired.id, 'cs_live_expiredfixture', 'paid', 'pi_late', 'evt_late']), /Conflicting terminal/);
  assert.equal((await db.query('select count(*)::int as n from gala_payment_events')).rows[0].n, 2);
  assert.equal((await db.query('select count(*)::int as n from gala_accounting_outbox')).rows[0].n, 0);
  const snapshot = await rpc('gala_ledger_snapshot');
  assert.equal(ledgerReport(snapshot, new Date().toISOString(), 'live').paidAmount, 212000);
  assert.throws(() => ledgerReport(snapshot), /payment evidence/);
  assert.equal((await rpc('gala_assignment_list')).length, 1);
  assert.equal((await rpc('gala_gift_list')).length, 1);
  await rpc('gala_assign_table_line', [paid.id, 8, 0, 0]);
  assert.equal((await db.query('select actor from gala_assignment_events')).rows[0].actor, 'shared-admin');
});

test('browser roles cannot read or execute private data; the application cannot open sales or reconnect accounting', async t => {
  const { db, rpc } = await setup(t);
  for (const role of ['anon', 'authenticated']) {
    const exposed = await db.query(`select relname from pg_class where relnamespace='public'::regnamespace and relkind='r'
      and (has_table_privilege($1,oid,'SELECT') or has_table_privilege($1,oid,'INSERT') or has_table_privilege($1,oid,'UPDATE') or has_table_privilege($1,oid,'DELETE'))`, [role]);
    assert.deepEqual(exposed.rows, []);
    const executable = await db.query("select proname from pg_proc where pronamespace='public'::regnamespace and has_function_privilege($1,oid,'EXECUTE')", [role]);
    assert.deepEqual(executable.rows, []);
    await db.exec(`set role ${role}`);
    await assert.rejects(rpc('gala_ledger_snapshot'), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  for (const sql of ['update gala_operating_state set sales_open=true', "update gala_environment set name='wrong'", 'select * from gala_qb_connection', 'select * from gala_staff_sessions'])
    await assert.rejects(db.exec(sql), /permission denied/);
  await assert.rejects(rpc('gala_qb_lock', [randomUUID()]), /permission denied/);
  await assert.rejects(rpc('gala_final_claim', [randomUUID(), randomUUID()]), /permission denied/);
  await assert.rejects(rpc('gala_accounting_claim', [randomUUID(), randomUUID()]), /permission denied/);
});

test('invitation ownership and closure remain separate from orders and preserve requester retries', async t => {
  const { db, rpc, open } = await setup(t);
  await db.exec('set role service_role');
  const request = invitation();
  await assert.rejects(rpc('gala_customer_invitations', [alice, JSON.stringify(request)]), /submissions are closed/);
  await open();
  await rpc('gala_customer_invitations', [alice, JSON.stringify(request)]);
  await assert.rejects(rpc('gala_customer_invitations', [bob, JSON.stringify(request)]), /Request unavailable/);
  await assert.rejects(rpc('gala_request_invitations', [JSON.stringify(invitation())]), /ownership required/);
  await db.exec('reset role; update gala_operating_state set invitations_open=false; set role service_role;');
  await rpc('gala_customer_invitations', [alice, JSON.stringify(request)]);
  await assert.rejects(rpc('gala_customer_invitations', [alice, JSON.stringify(invitation())]), /submissions are closed/);
  assert.equal((await db.query('select count(*)::int as n from gala_invitation_requests')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int as n from gala_orders')).rows[0].n, 0);
});
