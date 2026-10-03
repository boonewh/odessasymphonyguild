import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { syncReceipt } from '../lib/gala/backend/accounting.ts';

for (const phase of ['before-provider-send', 'after-provider-save']) {
  test(`terminated worker recovers safely: ${phase}`, { timeout: 60000 }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'osg-gala-crash-'));
    let child, db;
    try {
      child = fork(new URL('./helpers/gala-crash-worker.mjs', import.meta.url), [root, phase], {
        execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
      const checkpoint = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Crash worker checkpoint timed out')), 25000);
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('exit', () => { clearTimeout(timer); reject(new Error('Worker exited before checkpoint')); });
        child.once('message', message => { clearTimeout(timer); resolve(message); });
      });
      assert.equal(checkpoint.checkpoint, phase);
      assert.equal(child.kill('SIGKILL'), true);
      await exited;
      db = new PGlite(path.join(root, 'database'));
      const rpc = async (name, args) => (await db.query(`select ${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as value`, args)).rows[0].value;
      const getJob = async () => (await db.query('select * from gala_accounting_outbox where order_id=$1', [checkpoint.id])).rows[0];
      const saved = await getJob();
      assert.equal(saved.status, 'processing'); assert.ok(saved.dispatched_at); assert.equal(saved.receipt_id, null);
      const owner = randomUUID();
      assert.equal(await rpc('gala_qb_lock', [owner]), false);
      assert.equal(await rpc('gala_accounting_claim', [checkpoint.id, owner]), null);
      // Advance only this disposable local database's lease timestamps. No production
      // SQL or hosted state is changed; the child termination above is real.
      await db.query("update gala_qb_connection set lock_until=now()-interval '1 second' where id=1");
      await db.query("update gala_accounting_outbox set lease_until=now()-interval '1 second' where order_id=$1", [checkpoint.id]);
      assert.equal(await rpc('gala_qb_lock', [owner]), true);
      const store = {
        claim: (a, b) => rpc('gala_accounting_claim', [a, b]),
        prepare: (a, b, c, d) => rpc('gala_accounting_prepare', [a, b, c, JSON.stringify(d)]),
        dispatch: (a, b) => rpc('gala_accounting_dispatch', [a, b]),
        finish: (a, b, c) => rpc('gala_accounting_finish', [a, b, c]),
        review: (a, b, c) => rpc('gala_accounting_review', [a, b, c]),
      };
      let creates = 0;
      const gateway = { realmId: '123', find: async () => {
        if (phase === 'before-provider-send') return [];
        return JSON.parse(await readFile(path.join(root, 'provider.json'), 'utf8'));
      }, create: async () => { creates++; throw new Error('Must not resend uncertain dispatch'); } };
      const prepare = async () => { throw new Error('Must reuse durable payload'); };
      assert.equal(await syncReceipt(store, gateway, checkpoint.id, owner, prepare), phase === 'after-provider-save' ? 'synced' : 'review');
      await syncReceipt(store, gateway, checkpoint.id, owner, prepare);
      assert.equal(creates, 0);
      const final = await getJob();
      assert.equal(final.receipt_id, phase === 'after-provider-save' ? '99' : null);
      assert.equal(new Date(final.dispatched_at).getTime(), new Date(saved.dispatched_at).getTime());
      await assert.rejects(rpc('gala_accounting_finish', [checkpoint.id, checkpoint.owner, '999']));
      const order = (await db.query('select status,tier from gala_orders where id=$1', [checkpoint.id])).rows[0];
      assert.equal(order.status, 'paid'); assert.equal(order.tier, 'gold');
      const inventory = (await db.query("select capacity from gala_inventory where tier='gold'")).rows[0];
      assert.equal(inventory.capacity, 20);
      await rpc('gala_qb_unlock', [owner]);
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        const closed = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGKILL'); await closed;
      }
      if (db) await db.close();
      const resolved = await realpath(root), parent = await realpath(tmpdir());
      if (path.dirname(resolved).toLowerCase() !== parent.toLowerCase() || !path.basename(resolved).startsWith('osg-gala-crash-'))
        throw new Error('Unexpected temporary test directory; refusing cleanup');
      await rm(resolved, { recursive: true, force: true });
    }
  });
}
