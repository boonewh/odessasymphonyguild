import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { testDatabase } from './helpers/gala-database.mjs';
import { databaseFetch } from '../lib/gala/backend/database-fetch.ts';
import { SupabaseOrderStore } from '../lib/gala/backend/store.ts';
import { SupabaseRecoveryStore } from '../lib/gala/backend/recovery-store.ts';
import { priceRequest } from '../lib/gala/backend/domain.ts';

async function serve(t, handler) {
  const server = createServer((req, res) => { Promise.resolve(handler(req, res)).catch(() => { res.statusCode = 500; res.end('{}'); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('database adapters terminate stalled headers and partial response bodies rather than hanging the worker', { timeout: 10000 }, async t => {
  const seen = [];
  const url = await serve(t, (req, res) => {
    seen.push(req.url);
    if (!req.url.includes('gala_environment')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{'); // Headers arrive; body deliberately never finishes.
    }
  });
  const transport = databaseFetch(250);
  const orders = new SupabaseOrderStore(url, 'fictional-service-key', transport);
  const queue = new SupabaseRecoveryStore(url, 'fictional-service-key', transport);
  await assert.rejects(orders.verifyEnvironment(), /marker is missing/);
  await assert.rejects(orders.get(randomUUID()), /not found/);
  await assert.rejects(queue.dashboard(), /unavailable/);
  assert.equal(seen.length, 3);
});

test('database deadlines preserve caller cancellation and allow healthy responses', { timeout: 10000 }, async t => {
  const url = await serve(t, (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); });
  const transport = databaseFetch(2000);
  assert.deepEqual(await (await transport(url)).json(), { ok: true });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(transport(url, { signal: controller.signal }), /abort/i);
  await assert.rejects(transport(new Request(url, { signal: controller.signal })), /abort/i);
});

test('timed-out committed recovery claims retain holds and leases; later recovery rejects the stale owner', { timeout: 15000 }, async t => {
  const { db, store } = await testDatabase(); t.after(() => db.close());
  await db.exec(await readFile(new URL('../supabase/gala-development/008_gala_payment_recovery.sql', import.meta.url), 'utf8'));
  const input = { requestId: randomUUID(), kind: 'tables', allSalesFinal: true,
    contact: { name: 'Fictional Buyer', email: 'timeout@example.com', phone: '4325550100' },
    purchase: { product: 'gold', quantity: 1, extraSeats: 0 } };
  await store.reserve(priceRequest(input));
  let loseResponse = true;
  const url = await serve(t, async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const args = JSON.parse(raw);
    let result;
    if (req.url.endsWith('/gala_claim_recovery')) {
      result = (await db.query('select gala_claim_recovery($1) as result', [args.p_token])).rows[0].result;
    } else if (req.url.endsWith('/gala_finish_recovery')) {
      result = (await db.query('select gala_finish_recovery($1,$2,$3) as result', [args.p_order, args.p_token, args.p_outcome])).rows[0].result;
    } else throw Error('Unexpected RPC');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (loseResponse) { loseResponse = false; res.write('{'); }
    else res.end(JSON.stringify(result));
  });
  const queue = new SupabaseRecoveryStore(url, 'fictional-service-key', databaseFetch(750));
  const first = randomUUID(), second = randomUUID();
  await assert.rejects(queue.claim(first), /unavailable/);
  assert.equal((await store.get(input.requestId)).status, 'reserved');
  assert.equal((await db.query('select lease_token from gala_payment_recovery')).rows[0].lease_token, first);
  assert.equal(await queue.claim(second), null);
  await db.exec("update gala_payment_recovery set lease_until = now() - interval '1 second'");
  assert.equal((await queue.claim(second)).id, input.requestId);
  await assert.rejects(queue.finish(input.requestId, first, 'pending'), /unavailable/);
  await queue.finish(input.requestId, second, 'pending');
  assert.equal((await store.get(input.requestId)).status, 'reserved');
  assert.equal((await db.query('select * from gala_accounting_outbox')).rows.length, 0);
});
