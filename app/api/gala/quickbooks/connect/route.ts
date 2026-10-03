import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import OAuthClient from "intuit-oauth";
import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { authorizeDevelopment } from "@/lib/gala/backend/server";
import { readQbConfig } from "@/lib/gala/backend/qb-config";
import { qbOAuth } from "@/lib/gala/backend/qb-client";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try { authorizeDevelopment(request, readBackendConfig(process.env).token); }
  catch { return new Response(null, { status: 403 }); }
  try {
    const config = readQbConfig(process.env);
    const state = randomBytes(32).toString("hex");
    const url = qbOAuth(config).authorizeUri({ scope: [OAuthClient.scopes.Accounting], state });
    const response = NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set("gala_qb_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: false,
      path: "/api/gala/quickbooks/callback", maxAge: 600 });
    return response;
  } catch { return Response.json({ error: "Configure the dedicated QuickBooks sandbox settings first." }, { status: 409 }); }
}
