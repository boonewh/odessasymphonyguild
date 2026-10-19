import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { sharedAdminTestEnabled, SHARED_ADMIN_COOKIE, ADMIN_SECONDS } from "@/lib/admin/test-access";
import { createAdminSession } from "@/lib/admin/test-session";
import { sharedAdminConfig, authorizeSharedAdmin } from "@/lib/admin/test-server";
import { AccessStore } from "@/lib/gala/backend/access-store";
import { readLoginBody, LoginBodyTooLarge } from "@/lib/gala/backend/staff-login";
import { equalSecret, DEVELOPMENT_COOKIE } from "@/lib/gala/backend/auth";
import { CUSTOMER_COOKIE } from "@/lib/gala/backend/access";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  if (!sharedAdminTestEnabled(process.env)) return new Response(null, { status: 404, headers });
  try { authorizeSharedAdmin(request); return NextResponse.json({ authenticated: true }, { headers }); }
  catch { return new Response(null, { status: 401, headers }); }
}
export async function POST(request: Request) {
  if (!sharedAdminTestEnabled(process.env)) return new Response(null, { status: 404, headers });
  try {
    const config = sharedAdminConfig();
    if (request.headers.get("origin") !== config.origin) return new Response(null, { status: 403, headers });
    const body = await readLoginBody(request);
    if (!body || typeof body !== "object" || !("password" in body) || typeof body.password !== "string" || body.password.length > 256)
      return new Response(null, { status: 401, headers });
    // Shared volunteers have no email identity. Use the existing durable global
    // 120-attempt/5-minute budget, without inventing IP identities or locking all
    // volunteers into the named-account five-attempt window. Failed storage denies login.
    const admission = await new AccessStore(config.url, config.dbKey).consumeLogin(randomBytes(32).toString("hex"));
    if (!admission.allowed) return NextResponse.json({ error: "Too many sign-in attempts. Please try again shortly." },
      { status: 429, headers: { ...headers, "Retry-After": String(admission.retryAfter) } });
    if (!equalSecret(body.password, config.password)) return new Response(null, { status: 401, headers });
    const response = NextResponse.json({ authenticated: true }, { headers });
    response.cookies.set(SHARED_ADMIN_COOKIE, createAdminSession(config.token, config.password), {
      httpOnly: true, secure: config.hosted, sameSite: "lax", path: "/", maxAge: ADMIN_SECONDS,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again." },
      { status: error instanceof LoginBodyTooLarge ? 413 : error instanceof SyntaxError ? 400 : 503, headers });
  }
}
export async function DELETE(request: Request) {
  if (!sharedAdminTestEnabled(process.env)) return new Response(null, { status: 404, headers });
  const config = sharedAdminConfig();
  if (request.headers.get("origin") !== config.origin) return new Response(null, { status: 403, headers });
  const response = NextResponse.json({ signedOut: true }, { headers });
  for (const name of [SHARED_ADMIN_COOKIE, DEVELOPMENT_COOKIE, CUSTOMER_COOKIE])
    response.cookies.set(name, "", { httpOnly: true, secure: config.hosted, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
