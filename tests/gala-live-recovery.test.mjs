import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { scheduledRecoveryEnabled, authorizeScheduledRecovery } from '../lib/gala/backend/scheduled-recovery.ts';

test('live scheduled recovery stays inaccessible with the committed closed release gate', () => {
  const secret = 'b'.repeat(64);
  const env = { NODE_ENV: 'production', VERCEL_ENV: 'production', GALA_LIVE_ENABLED: 'true', GALA_LIVE_RECOVERY_SECRET: secret };
  assert.equal(scheduledRecoveryEnabled(env), false);
  assert.equal(authorizeScheduledRecovery(new Request('https://gala.example/api/gala/recovery/run',
    { method: 'POST', headers: { authorization: `Bearer ${secret}` } }), env), false);
});

test('actual live recovery handler rejects test credentials and verifies payments before settling or expiring', async () => {
  await mkdir('.codex-remote-attachments', { recursive: true });
  const outfile = '.codex-remote-attachments/live-recovery-fixture.mjs';
  await build({
    entryPoints: ['tests/helpers/live-recovery.mts'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external',
    plugins: [{ name: 'offline-recovery-fixture', setup(b) {
      // Only this disposable test bundle opens the gate or replaces Stripe.
      b.onResolve({ filter: /^stripe$/ }, () => ({ path: resolve('tests/helpers/recovery-provider.mts') }));
      b.onLoad({ filter: /live-release\.ts$/ }, async args => ({
        contents: (await readFile(args.path, 'utf8')).replace('LIVE_RELEASE_APPROVED: boolean = false', 'LIVE_RELEASE_APPROVED: boolean = true'), loader: 'ts',
      }));
    } }],
  });
  const result = spawnSync(process.execPath, [outfile], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
