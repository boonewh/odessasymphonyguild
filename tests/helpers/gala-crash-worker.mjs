// Child process used only by the disk-backed local crash test. No network calls.
import { PGlite } from '@electric-sql/pglite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { priceRequest } from '../../lib/gala/backend/domain.ts';
import { receiptFor, syncReceipt } from '../../lib/gala/backend/accounting.ts';

const [root, phase] = process.argv.slice(2);
const db = new PGlite(path.join(root, 'database'));
await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
for (const migration of ['001_gala_backend.sql', '002_gala_accounting.sql'])
  await db.exec(await readFile(new URL('../../supabase/gala-development/' + migration, import.meta.url), 'utf8'));
const rpc = async (name, args) => (await db.query(`select ${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as value`, args)).rows[0].value;
const id = randomUUID(), owner = randomUUID();
const quote = priceRequest({ requestId: id, kind: 'tables', allSalesFinal: true,
  contact: { name: 'Local Crash Test', email: 'crash-test@example.com', phone: '4325550100' },
  purchase: { product: 'gold', quantity: 1, extraSeats: 0 } });
await rpc('gala_reserve', [id, quote.hash, JSON.stringify(quote.details), quote.amount, quote.description, quote.tier]);
const order = await rpc('gala_apply_payment', [id, 'cs_test_crash', 'paid', 'pi_test_crash', 'evt_test_crash']);
await rpc('gala_qb_lock', [owner]);
const store = {
  claim: (a, b) => rpc('gala_accounting_claim', [a, b]),
  prepare: (a, b, c, d) => rpc('gala_accounting_prepare', [a, b, c, JSON.stringify(d)]),
  dispatch: (a, b) => rpc('gala_accounting_dispatch', [a, b]),
  finish: (a, b, c) => rpc('gala_accounting_finish', [a, b, c]),
  review: (a, b, c) => rpc('gala_accounting_review', [a, b, c]),
};
const mapping = { realmId: '123', customerId: '10', itemId: '20', incomeAccountId: '30', clearingAccountId: '40' };
const gateway = { realmId: '123', find: async () => [], create: async payload => {
  if (phase === 'after-provider-save') {
    await writeFile(path.join(root, 'provider.json'), JSON.stringify([{ ...payload, Id: '99', TotalAmt: 3500 }]), { flush: true });
  }
  // Dispatch is durable, but the worker has neither received success nor run cleanup.
  process.send({ checkpoint: phase, id, owner });
  await new Promise(() => {});
} };
await syncReceipt(store, gateway, id, owner, async () => receiptFor(order, mapping, 1790967600));
