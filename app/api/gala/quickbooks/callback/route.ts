import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { backendEnabled } from "@/lib/gala/backend/config";
import { equalSecret } from "@/lib/gala/backend/auth";
import { readQbConfig } from "@/lib/gala/backend/qb-config";
import { qbOAuth } from "@/lib/gala/backend/qb-client";
import { sealTokens } from "@/lib/gala/backend/qb-tokens";
import { AccountingDatabase } from "@/lib/gala/backend/accounting-store";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  let origin: string;
  let connected = false;
  try {
    const config = readQbConfig(process.env); origin = config.origin;
    const params = request.nextUrl.searchParams;
    const state = params.get("state") || "";
    if (!/^[a-f0-9]{64}$/.test(state) || !equalSecret(state, request.cookies.get("gala_qb_oauth_state")?.value || "")
      || params.get("realmId") !== config.realmId || !params.get("code") || params.has("error")) throw new Error("Authorization mismatch.");
    const db = new AccountingDatabase(config.url, config.dbKey); await db.verify();
    const owner = randomUUID(); await db.lock(owner);
    try {
      const { token } = await qbOAuth(config).createToken(`${config.redirectUri}?${params.toString()}`);
      await db.saveTokens(owner, sealTokens({ realmId: config.realmId, accessToken: token.access_token,
        refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000,
        refreshExpiresAt: Date.now() + token.x_refresh_token_expires_in * 1000 }, config.encryptionKey));
      connected = true;
    } finally { await db.unlock(owner); }
  } catch {
    origin = process.env.GALA_LOCAL_ORIGIN || "http://localhost:3000";
    if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return new Response(null, { status: 400 });
  }
  const response = NextResponse.redirect(`${origin}/gala/preview/admin?qb=${connected ? "sandbox-connected" : "sandbox-error"}`, 303);
  response.cookies.set("gala_qb_oauth_state", "", { path: "/api/gala/quickbooks/callback", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
