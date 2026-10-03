// Refresh only the authorized sandbox connection; never print credentials.
import { randomUUID } from "node:crypto";
import { readQbConfig, readQbMapping } from "../lib/gala/backend/qb-config";
import { AccountingDatabase } from "../lib/gala/backend/accounting-store";
import { openTokens, sealTokens } from "../lib/gala/backend/qb-tokens";
import { qbAccessToken, SandboxQuickBooks } from "../lib/gala/backend/qb-client";

async function main() {
  if (process.env.GALA_QB_REFRESH_TEST !== "true") throw new Error("Explicit sandbox refresh test required.");
  const config = readQbConfig(process.env), mapping = readQbMapping(process.env);
  // Present an expired access-token timestamp to the normal refresh code without
  // overwriting the stored connection first. Intuit performs the actual refresh.
  class ExpiredView extends AccountingDatabase {
    override async loadTokens() {
      const saved = await super.loadTokens();
      if (!saved) throw new Error("Connect the sandbox first.");
      const tokens = openTokens(saved, config.encryptionKey, config.realmId);
      return sealTokens({ ...tokens, expiresAt: 0 }, config.encryptionKey);
    }
  }
  const db = new AccountingDatabase(config.url, config.dbKey); await db.verify();
  const owner = randomUUID(); await db.lock(owner);
  try {
    const expiredView = new ExpiredView(config.url, config.dbKey);
    const token = await qbAccessToken(config, expiredView, owner);
    const saved = await db.loadTokens();
    if (!saved) throw new Error("Refreshed connection was not saved.");
    const current = openTokens(saved, config.encryptionKey, config.realmId);
    if (current.accessToken !== token || current.expiresAt <= Date.now() + 60_000 || current.refreshExpiresAt <= Date.now())
      throw new Error("Refreshed credentials did not persist correctly.");
    await new SandboxQuickBooks(config.realmId, token).verifyMapping(mapping);
    const reused = await qbAccessToken(config, db, owner);
    if (reused !== token || await db.loadTokens() !== saved) throw new Error("Valid token was needlessly refreshed.");
    console.log("PASS: Intuit sandbox refresh succeeded, encrypted credentials persisted, authenticated mapping reads passed, and the next call reused the valid token.");
  } finally { await db.unlock(owner); }
}
main().catch(() => { console.error("Sandbox refresh check failed; review connection status without exposing credentials."); process.exitCode = 1; });
