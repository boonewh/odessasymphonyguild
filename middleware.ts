import { NextRequest, NextResponse } from "next/server";
import { clientReviewAllowed, clientReviewRequest } from "./lib/gala/client-review";
import { boardReviewAllowed, boardReviewRequest, BOARD_ORIGIN } from "./lib/gala/board-review";
import { sharedAdminTestEnabled } from "./lib/admin/test-access";
import { liveSiteEnabled } from "./lib/gala/live-release";
import { liveAdminConfig } from "./lib/admin/live-config";
import { authorizeLiveAdmin } from "./lib/admin/live-session";
import { readLiveConfig } from "./lib/gala/backend/live-config";

// Preserve the existing Dues entrance until the approved shared-admin release.
// Once released, all Dues pages/APIs use the expiring shared session below.

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

  const admin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  const gala = pathname.startsWith("/gala/") || pathname.startsWith("/api/gala/");
  if (liveSiteEnabled(process.env) && (admin || gala)) {
    let live: ReturnType<typeof readLiveConfig>;
    try { live = readLiveConfig(process.env); }
    catch { return new NextResponse("Temporarily unavailable", { status: 503 }); }
    if (request.headers.get("host") !== new URL(live.origin).host
        || !(request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https"))
      return new NextResponse(null, { status: 404 });
    if (admin) {
      if (pathname === "/api/admin/test-session") return new NextResponse(null, { status: 404 });
      let adminConfig: ReturnType<typeof liveAdminConfig>;
      try { adminConfig = liveAdminConfig(); }
      catch { return new NextResponse("Temporarily unavailable", { status: 503 }); }
      try {
        if (!["/admin/login", "/api/admin/session", "/api/admin/login", "/api/admin/logout"].includes(pathname))
          authorizeLiveAdmin(request, adminConfig);
        const response = NextResponse.next();
        response.headers.set("Cache-Control", "no-store");
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
        return response;
      } catch {
        return pathname.startsWith("/api/") ? NextResponse.json({ error: "Admin sign-in required." }, { status: 401 })
          : NextResponse.redirect(new URL("/admin/login", request.url));
      }
    }
  }
  if (pathname === "/api/admin/session") return new NextResponse(null, { status: 404 });
  // Allow the login page and login API through without a session check
  // New test-only pages authenticate on the server; never open legacy dues APIs.
  if (sharedAdminTestEnabled(process.env) && ["/admin", "/admin/dues", "/admin/gala", "/admin/patron", "/api/admin/patrons", "/api/admin/test-session"].includes(pathname)) {
    return NextResponse.next();
  }
  if (!sharedAdminTestEnabled(process.env) && ["/admin", "/admin/dues", "/admin/gala", "/admin/patron", "/api/admin/patrons", "/api/admin/test-session"].includes(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }
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
  runtime: "nodejs",
  matcher: ["/:path*"],
};
