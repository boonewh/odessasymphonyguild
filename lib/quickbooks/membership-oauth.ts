import OAuthClient from "intuit-oauth";
import { membershipOAuthFlow } from "./oauth-flow";
import { oauthStateStore } from "./oauth-state-store";
import { saveTokens } from "./tokens";

function config() {
  return { clientId: process.env.QUICKBOOKS_CLIENT_ID || "",
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || "",
    environment: process.env.QUICKBOOKS_ENVIRONMENT || "production" };
}
function client() {
  const values = config();
  if (!process.env.QUICKBOOKS_CLIENT_SECRET) throw new Error("QuickBooks is not configured.");
  return new OAuthClient({ ...values, environment: values.environment as "sandbox" | "production",
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET });
}
export const membershipOAuth = membershipOAuthFlow({
  config, store: oauthStateStore, adminPassword: () => process.env.ADMIN_PASSWORD,
  authorize: state => client().authorizeUri({ scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.Payment], state }),
  exchangeAndSave: async callback => {
    const { token } = await client().createToken(callback);
    const now = Date.now();
    await saveTokens({ realmId: new URL(callback).searchParams.get("realmId")!,
      accessToken: token.access_token, refreshToken: token.refresh_token,
      expiresAt: new Date(now + token.expires_in * 1000),
      refreshExpiresAt: new Date(now + token.x_refresh_token_expires_in * 1000) });
  },
});
