import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { liveSiteEnabled } from '../lib/gala/live-release.ts';
import { backendEnabled } from '../lib/gala/backend/config.ts';
import { readLiveConfig } from '../lib/gala/backend/live-config.ts';

test('approved live routing requires explicit production flags and excludes test deployments', () => {
  const env = { NODE_ENV: 'production', VERCEL_ENV: 'production', GALA_LIVE_ENABLED: 'true', GALA_BACKEND_ENABLED: 'true' };
  assert.equal(liveSiteEnabled(env), true); assert.equal(backendEnabled(env), true);
  for (const patch of [{ GALA_LIVE_ENABLED: undefined }, { GALA_LIVE_ENABLED: 'false' },
    { VERCEL_ENV: 'preview' }, { VERCEL_ENV: undefined }, { NODE_ENV: 'development' },
    { GALA_BOARD_REVIEW: 'true' }, { GALA_CLIENT_REVIEW: 'true' }]) {
    assert.equal(liveSiteEnabled({ ...env, ...patch }), false);
  }
});
test('live configuration cannot fall back to test credentials or the development database', () => {
  const env = { GALA_LIVE_ORIGIN:'https://gala.example', GALA_LIVE_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
    GALA_LIVE_STRIPE_SECRET_KEY:'sk_live_offline', GALA_LIVE_SUPABASE_SECRET_KEY:'sb_secret_offline',
    GALA_LIVE_STRIPE_WEBHOOK_SECRET:'whsec_offline', GALA_LIVE_SESSION_SECRET:'a'.repeat(64) };
  assert.equal(readLiveConfig(env).paymentMode, 'live');
  for (const patch of [{GALA_LIVE_STRIPE_SECRET_KEY:'sk_test_fake'}, {GALA_LIVE_SESSION_SECRET:''},
    {GALA_LIVE_SUPABASE_URL:'https://rhjwjfyjjdsfahlegqvd.supabase.co'}, {GALA_LIVE_ORIGIN:'http://gala.example'},
    {GALA_LIVE_ORIGIN:'https://gala.example/path'}, {GALA_LIVE_ORIGIN:'https://test.vercel.app'}])
    assert.throws(() => readLiveConfig({...env,...patch}));
});
test('mounted live routes integrate private buyers, shared admin and Dues with fake providers only', async () => {
  // Exercise the actual approved routing code with fictional providers only.
  await mkdir('.codex-remote-attachments', {recursive:true});
  const outfile='.codex-remote-attachments/live-routes-fixture.mjs';
  await build({entryPoints:['tests/helpers/live-routes.mts'],outfile,bundle:true,platform:'node',format:'esm',packages:'external',alias:{'next/server':'next/server.js'}});
  const result = spawnSync(process.execPath, ['--conditions=react-server',outfile],
    {encoding:'utf8', windowsHide:true});
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
