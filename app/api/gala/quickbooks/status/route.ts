import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { authorizeDevelopment } from "@/lib/gala/backend/server";
import { QB_SETUP_KEYS, readQbConfig, readQbMapping } from "@/lib/gala/backend/qb-config";
import { openTokens } from "@/lib/gala/backend/qb-tokens";
import { AccountingDatabase } from "@/lib/gala/backend/accounting-store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try { authorizeDevelopment(request, readBackendConfig(process.env).token); }
  catch { return new Response(null, { status: 401 }); }
  const missing = QB_SETUP_KEYS.filter(k => !process.env[k]);
  let configured = false, connected = false, mapped = false, databaseReady = false;
  try {
    const config = readQbConfig(process.env); configured = true;
    const db = new AccountingDatabase(config.url, config.dbKey); await db.verify();
    const sealed = await db.loadTokens(); databaseReady = true;
    if (sealed) connected = openTokens(sealed, config.encryptionKey, config.realmId).refreshExpiresAt > Date.now();
    readQbMapping(process.env); mapped = true;
  } catch { /* Return setup status, never tokens or provider errors. */ }
  return Response.json({ configured, connected, mapped, databaseReady, missing,
    syncEnabled: process.env.GALA_QB_SYNC_ENABLED === "true", environment: "sandbox" }, { headers: { "Cache-Control": "no-store" } });
}
