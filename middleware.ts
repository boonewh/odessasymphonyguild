import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware — protects /admin/* routes with an httpOnly session cookie.
 * Uses Web Crypto API (required for Next.js Edge runtime).
 * The cookie value is HMAC-SHA256(ADMIN_PASSWORD) so it cannot be forged
 * without knowing the password, and the password is never sent to the browser.
 */

async function expectedToken(): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD ?? "";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode("osg-admin-session")
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the login page and login API through without a session check
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  // Protect all other /admin/* routes
  if (pathname.startsWith("/admin")) {
    const session = request.cookies.get("admin_session")?.value;

    if (session !== await expectedToken()) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
