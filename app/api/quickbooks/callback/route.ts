import { NextRequest, NextResponse } from "next/server";
import OAuthClient from "intuit-oauth";
import { saveTokens } from "@/lib/quickbooks/tokens";
import { SECURE_HEADERS } from "@/lib/api-headers";

/**
 * GET /api/quickbooks/callback
 *
 * Handles the OAuth redirect from Intuit after the treasurer authorizes.
 * Exchanges the auth code for access + refresh tokens, encrypts them,
 * and saves them to Supabase.
 *
 * Per Intuit's security requirements:
 * - Returns a 302 redirect (no HTML in response body)
 * - Tokens are AES-256-GCM encrypted before storage
 * - Realm ID is encrypted before storage
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code    = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state   = searchParams.get("state");
  const error   = searchParams.get("error");

  // User declined authorization
  if (error || !code || !realmId) {
    console.error("[QB Callback] Authorization failed or declined:", error);
    const res = NextResponse.redirect(new URL("/?qb=declined", request.url));
    Object.entries(SECURE_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  try {
    const oauthClient = new OAuthClient({
      clientId:     process.env.QUICKBOOKS_CLIENT_ID!,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
      environment:  (process.env.QUICKBOOKS_ENVIRONMENT as "sandbox" | "production") || "production",
      redirectUri:  process.env.QUICKBOOKS_REDIRECT_URI!,
    });

    // Exchange auth code for tokens
    const authResponse = await oauthClient.createToken(request.url);
    const token = authResponse.token;

    const now = Date.now();
    const expiresAt = new Date(now + token.expires_in * 1000);
    // Refresh tokens last 100 days
    const refreshExpiresAt = new Date(now + token.x_refresh_token_expires_in * 1000);

    // Encrypt and save tokens to Supabase
    await saveTokens({
      realmId,
      accessToken:      token.access_token,
      refreshToken:     token.refresh_token,
      expiresAt,
      refreshExpiresAt,
    });

    console.log("[QB Callback] Authorization successful. Realm ID saved.");

    // 302 redirect — no HTML in response body (Intuit security requirement)
    return NextResponse.redirect(
      new URL("/?qb=connected", request.url)
    );
  } catch (err) {
    console.error("[QB Callback] Token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/?qb=error", request.url)
    );
  }
}
