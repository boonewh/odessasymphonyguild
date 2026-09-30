import { NextRequest, NextResponse } from "next/server";
import { clientReviewAllowed, clientReviewRequest } from "./lib/gala/client-review";

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

  // Client review hosts expose only the Gala designs and their static assets.
  // No existing student, admin, payment, or QuickBooks endpoint is reachable.
  if (clientReviewAllowed(process.env.VERCEL_ENV, process.env.GALA_CLIENT_REVIEW)) {
    const access = clientReviewRequest(pathname, request.method);
    const response = access === "redirect"
      ? NextResponse.redirect(new URL("/gala/tables", request.url))
      : access === "allowed" ? NextResponse.next()
      : new NextResponse("Not found", { status: 404 });
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // Allow the login page and login API through without a session check
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  // Protect all other /admin/* pages and /api/admin/* endpoints
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const session = request.cookies.get("admin_session")?.value;

    if (session !== await expectedToken()) {
      // API callers get a 401; page requests get bounced to the login screen
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
