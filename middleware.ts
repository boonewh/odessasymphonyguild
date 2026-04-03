import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

/**
 * Middleware — protects /admin/* routes with an httpOnly session cookie.
 * The cookie value is HMAC-SHA256(ADMIN_PASSWORD) so it cannot be forged
 * without knowing the password, and the password is never sent to the browser.
 */

function expectedToken(): string {
  const secret = process.env.ADMIN_PASSWORD ?? "";
  return createHmac("sha256", secret).update("osg-admin-session").digest("hex");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the login page and login API through without a session check
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  // Protect all other /admin/* routes
  if (pathname.startsWith("/admin")) {
    const session = request.cookies.get("admin_session")?.value;

    if (session !== expectedToken()) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
