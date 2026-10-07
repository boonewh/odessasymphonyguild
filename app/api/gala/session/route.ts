import { NextResponse } from "next/server";
import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { createDevelopmentSession, DEVELOPMENT_COOKIE, equalSecret } from "@/lib/gala/backend/auth";
import { authorizeCustomer } from "@/lib/gala/backend/request-access";
import { CUSTOMER_COOKIE, CUSTOMER_SECONDS, cookieValue, createCustomerSession, customerIdentity, sameOrigin } from "@/lib/gala/backend/access";
import { readLoginBody, LoginBodyTooLarge } from "@/lib/gala/backend/staff-login";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try { authorizeCustomer(request); }
  catch { return Response.json({ accessMode: process.env.GALA_ACCESS_MODE || "development" }, { status: 401, headers: { "Cache-Control": "no-store" } }); }
  return Response.json({ authenticated: true }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try {
    const config = readBackendConfig(process.env);
    if (request.headers.get("origin") !== config.origin) return new Response(null, { status: 403 });
    if (config.accessMode === "individual") {
      sameOrigin(request, config.origin);
      let value = cookieValue(request, CUSTOMER_COOKIE);
      try { customerIdentity(value, config.token); } catch { value = createCustomerSession(config.token); }
      const response = NextResponse.json({ authenticated: true }, { headers: { "Cache-Control": "no-store" } });
      response.cookies.set(CUSTOMER_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: config.hosted, path: "/", maxAge: CUSTOMER_SECONDS });
      return response;
    }
    const body = await readLoginBody(request);
    const token = body && typeof body === "object" && "token" in body ? body.token : undefined;
    if (typeof token !== "string" || !equalSecret(token, config.accessCode)) return new Response(null, { status: 403 });
    const response = NextResponse.json({ authenticated: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(DEVELOPMENT_COOKIE, createDevelopmentSession(config.token), {
      httpOnly: true, sameSite: "lax", secure: config.hosted, path: "/", maxAge: 8 * 3600,
    });
    return response;
  } catch (error) { return Response.json({ error: "Test sign-in failed." }, { status: error instanceof LoginBodyTooLarge ? 413 : 403 }); }
}
export async function DELETE(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try {
    const config = readBackendConfig(process.env);
    sameOrigin(request, config.origin);
    const response = NextResponse.json({ signedOut: true }, { headers: { "Cache-Control": "no-store" } });
    for (const name of [DEVELOPMENT_COOKIE, CUSTOMER_COOKIE]) response.cookies.set(name, "", {
      httpOnly: true, sameSite: "lax", secure: config.hosted, path: "/", maxAge: 0,
    });
    return response;
  } catch { return new Response(null, { status: 403 }); }
}
