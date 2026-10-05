import { NextRequest, NextResponse } from "next/server";
import OAuthClient from "intuit-oauth";
import { randomBytes } from "crypto";
import { SECURE_HEADERS } from "@/lib/api-headers";

/**
 * GET /api/quickbooks/auth
 *
 * Generates the QuickBooks OAuth authorization URL and redirects the user
 * (the treasurer) to Intuit's login page to authorize the connection.
 *
 * Usage: the treasurer visits this URL once to connect OSG's QB account.
 * After authorizing, QB redirects to /api/quickbooks/callback.
 */
export async function GET(request: NextRequest) {
  // Simple auth check — only allow access with the admin password in the query
  const { searchParams } = new URL(request.url);
  const adminPassword = searchParams.get("key");

  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return new NextResponse("Unauthorized", { status: 401, headers: SECURE_HEADERS });
  }

  const oauthClient = new OAuthClient({
    clientId:     process.env.QUICKBOOKS_CLIENT_ID!,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
    environment:  (process.env.QUICKBOOKS_ENVIRONMENT as "sandbox" | "production") || "production",
    redirectUri:  process.env.QUICKBOOKS_REDIRECT_URI!,
  });

  // Generate a random state value to prevent CSRF
  const state = randomBytes(16).toString("hex");

  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.Payment],
    state,
  });

  // Redirect to Intuit login — do not return HTML (Intuit security requirement)
  return NextResponse.redirect(authUri);
}
