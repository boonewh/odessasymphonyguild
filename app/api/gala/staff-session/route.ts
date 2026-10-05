import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { AccessStore } from "@/lib/gala/backend/access-store";
import { STAFF_COOKIE, STAFF_SECONDS, cookieValue, sameOrigin, secretHash, staffSessionHash } from "@/lib/gala/backend/access";
import { authenticateStaff, LoginBodyTooLarge, readLoginBody } from "@/lib/gala/backend/staff-login";
export const runtime = "nodejs";
async function handle(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try {
    const config = readBackendConfig(process.env);
    if (config.accessMode !== "individual") return new Response(null, { status: 404 });
    sameOrigin(request, config.origin);
    const store = new AccessStore(config.url, config.dbKey);
    const headers = { "Cache-Control": "no-store" };
    if (request.method === "GET") return Response.json(await store.staff(staffSessionHash(request)), { headers });
    if (request.method === "DELETE") {
      await store.logout(staffSessionHash(request));
      const response = NextResponse.json({ signedOut: true }, { headers });
      response.cookies.set(STAFF_COOKIE, "", { path: "/", maxAge: 0 }); return response;
    }
    let body: unknown;
    try { body = await readLoginBody(request); }
    catch (error) { if (error instanceof LoginBodyTooLarge) return new Response(null, { status: 413, headers }); throw error; }
    const result = await authenticateStaff(body, config.token, bucket => store.consumeLogin(bucket),
      (email, password) => new AccessStore(config.url, config.dbKey).login(email, password));
    if (result.status !== 200) return Response.json({ error: result.status === 429
      ? "Too many sign-in attempts. Wait before trying again."
      : result.status === 503 ? "Staff sign-in is temporarily unavailable. Try again shortly."
      : "Staff sign-in or access could not be verified." }, {
      status: result.status, headers: { ...headers, ...("retryAfter" in result ? { "Retry-After": String(result.retryAfter) } : {}) },
    });
    const value = randomBytes(32).toString("hex"), hash = secretHash(value);
    const previous = cookieValue(request, STAFF_COOKIE);
    await store.rotateSession(result.userId, hash, /^[a-f0-9]{64}$/.test(previous) ? secretHash(previous) : undefined);
    const response = NextResponse.json({ authenticated: true }, { headers });
    response.cookies.set(STAFF_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: STAFF_SECONDS });
    return response;
  } catch { return Response.json({ error: "Staff sign-in or access could not be verified." }, { status: 401, headers: { "Cache-Control": "no-store" } }); }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
