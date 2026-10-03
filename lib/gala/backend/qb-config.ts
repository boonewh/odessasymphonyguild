import { readBackendConfig } from "./config";

export const QB_SANDBOX_BASE = "https://sandbox-quickbooks.api.intuit.com/v3/company/";
export const QB_SETUP_KEYS = ["GALA_QB_CLIENT_ID", "GALA_QB_CLIENT_SECRET", "GALA_QB_REALM_ID", "GALA_QB_ENCRYPTION_KEY"] as const;
export function readQbConfig(env: NodeJS.ProcessEnv) {
  const local = readBackendConfig(env);
  // Never fall back to the Belles & Beaux production credentials/token table.
  if (env.GALA_QB_ENVIRONMENT !== "sandbox") throw new Error("Explicit QuickBooks sandbox environment required.");
  if (QB_SETUP_KEYS.some(k => !env[k]) || !/^\d+$/.test(env.GALA_QB_REALM_ID!)
    || !/^[a-f0-9]{64}$/.test(env.GALA_QB_ENCRYPTION_KEY!)) throw new Error("QuickBooks sandbox setup incomplete.");
  return { ...local, clientId: env.GALA_QB_CLIENT_ID!, clientSecret: env.GALA_QB_CLIENT_SECRET!,
    realmId: env.GALA_QB_REALM_ID!, encryptionKey: env.GALA_QB_ENCRYPTION_KEY!,
    redirectUri: `${local.origin}/api/gala/quickbooks/callback`, environment: "sandbox" as const };
}
export function readQbMapping(env: NodeJS.ProcessEnv) {
  const config = readQbConfig(env);
  const mapping = { realmId: config.realmId, customerId: env.GALA_QB_CUSTOMER_ID || "", itemId: env.GALA_QB_ITEM_ID || "",
    incomeAccountId: env.GALA_QB_INCOME_ACCOUNT_ID || "", clearingAccountId: env.GALA_QB_CLEARING_ACCOUNT_ID || "" };
  if (Object.values(mapping).some(id => !/^\d+$/.test(id))) throw new Error("Sandbox accounting mapping required.");
  return mapping;
}
