import { NextResponse } from "next/server";
import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { createDevelopmentSession, DEVELOPMENT_COOKIE, equalSecret } from "@/lib/gala/backend/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try {
    const config = readBackendConfig(process.env);
    if (request.headers.get("origin") !== config.origin) return new Response(null, { status: 403 });
    const text = await request.text();
    if (text.length > 1024) return new Response(null, { status: 413 });
    const { token } = JSON.parse(text);
    if (typeof token !== "string" || !equalSecret(token, config.token)) return new Response(null, { status: 403 });
    const response = NextResponse.json({ authenticated: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(DEVELOPMENT_COOKIE, createDevelopmentSession(config.token), {
      httpOnly: true, sameSite: "strict", secure: false, path: "/", maxAge: 8 * 3600,
    });
    return response;
  } catch { return Response.json({ error: "Local sign-in failed." }, { status: 403 }); }
}
