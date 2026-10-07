import { NextRequest, NextResponse } from "next/server";
import { clientReviewAllowed, clientReviewRequest } from "./lib/gala/client-review";
import { boardReviewAllowed, boardReviewRequest, BOARD_ORIGIN } from "./lib/gala/board-review";

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

  // The functional board test exposes only explicitly enumerated Gala routes.
  // A missing/mistyped flag, wrong branch/project or alias fails closed.
  if (process.env.VERCEL_ENV === "preview" && process.env.GALA_BOARD_REVIEW === "true") {
    // Vercel terminates TLS before forwarding to Next; nextUrl can describe the
    // internal HTTP listener. Validate the public Host and platform TLS header.
    const boardHost = request.headers.get("host") === new URL(BOARD_ORIGIN).host
      && (request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https");
    const access = boardReviewAllowed(process.env) && boardHost
      ? boardReviewRequest(pathname, request.method) : "blocked";
    const response = access === "redirect" ? NextResponse.redirect(new URL("/gala/tables", BOARD_ORIGIN))
      : access === "allowed" ? NextResponse.next() : new NextResponse("Not found", { status: 404 });
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

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
