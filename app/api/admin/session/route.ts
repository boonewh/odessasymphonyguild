import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { liveSiteEnabled } from "@/lib/gala/live-release";
import { liveAdminConfig } from "@/lib/admin/live-config";
import { authorizeLiveAdmin, createLiveAdminSession, LIVE_ADMIN_COOKIE, liveAdminCookieOptions } from "@/lib/admin/live-session";
import { AccessStore } from "@/lib/gala/backend/access-store";
import { SupabaseOrderStore } from "@/lib/gala/backend/store";
import { readLoginBody, LoginBodyTooLarge } from "@/lib/gala/backend/staff-login";
import { equalSecret } from "@/lib/gala/backend/auth";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  if (!liveSiteEnabled(process.env)) return new Response(null, { status: 404, headers });
  try { authorizeLiveAdmin(request, liveAdminConfig()); return NextResponse.json({ authenticated: true }, { headers }); }
  catch { return new Response(null, { status: 401, headers }); }
}
export async function POST(request: Request) {
  if (!liveSiteEnabled(process.env)) return new Response(null, { status: 404, headers });
  try {
    const config = liveAdminConfig();
    if (request.headers.get("origin") !== config.origin) return new Response(null, { status: 403, headers });
    const body = await readLoginBody(request);
    if (!body || typeof body !== "object" || !("password" in body) || typeof body.password !== "string" || body.password.length > 256)
      return new Response(null, { status: 401, headers });
    await new SupabaseOrderStore(config.url, config.dbKey).verifyEnvironment("live");
    const admission = await new AccessStore(config.url, config.dbKey).consumeLogin(randomBytes(32).toString("hex"));
    if (!admission.allowed) return NextResponse.json({ error: "Too many sign-in attempts. Please try again shortly." },
      { status: 429, headers: { ...headers, "Retry-After": String(admission.retryAfter) } });
    if (!equalSecret(body.password, config.password)) return new Response(null, { status: 401, headers });
    const response = NextResponse.json({ authenticated: true }, { headers });
    response.cookies.set(LIVE_ADMIN_COOKIE, createLiveAdminSession(config), liveAdminCookieOptions);
    // Retire the former Dues cookie when moving to the shared entrance.
    response.cookies.set("admin_session", "", { ...liveAdminCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again." },
      { status: error instanceof LoginBodyTooLarge ? 413 : error instanceof SyntaxError ? 400 : 503, headers });
  }
}
export async function DELETE(request: Request) {
  if (!liveSiteEnabled(process.env)) return new Response(null, { status: 404, headers });
  try {
    const config = liveAdminConfig();
    if (request.headers.get("origin") !== config.origin) return new Response(null, { status: 403, headers });
    const response = NextResponse.json({ signedOut: true }, { headers });
    for (const name of [LIVE_ADMIN_COOKIE, "admin_session"])
      response.cookies.set(name, "", { ...liveAdminCookieOptions, maxAge: 0 });
    return response;
  } catch { return new Response(null, { status: 503, headers }); }
}
