import OAuthClient from "intuit-oauth";
import { QB_SANDBOX_BASE, type readQbConfig } from "./qb-config";
import { openTokens, sealTokens } from "./qb-tokens";
import type { AccountingDatabase } from "./accounting-store";
import type { AccountingMapping, Receipt, ReceiptGateway } from "./accounting";

type Config = ReturnType<typeof readQbConfig>;
export function qbOAuth(config: Config) {
  return new OAuthClient({ clientId: config.clientId, clientSecret: config.clientSecret, environment: "sandbox", redirectUri: config.redirectUri });
}
// Caller holds the database connection lease across refresh/save and accounting work.
export async function qbAccessToken(config: Config, db: AccountingDatabase, owner: string) {
  const sealed = await db.loadTokens();
  if (!sealed) throw new Error("Connect the QuickBooks sandbox first.");
  let tokens = openTokens(sealed, config.encryptionKey, config.realmId);
  if (tokens.expiresAt < Date.now() + 60_000) {
    if (tokens.refreshExpiresAt <= Date.now()) throw new Error("Reconnect the sandbox.");
    const oauth = qbOAuth(config);
    oauth.setToken({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken, token_type: "bearer", expires_in: 0,
      x_refresh_token_expires_in: Math.floor((tokens.refreshExpiresAt - Date.now()) / 1000) });
    const { token } = await oauth.refresh();
    tokens = { realmId: config.realmId, accessToken: token.access_token, refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000, refreshExpiresAt: Date.now() + token.x_refresh_token_expires_in * 1000 };
    await db.saveTokens(owner, sealTokens(tokens, config.encryptionKey));
  }
  return tokens.accessToken;
}

export class SandboxQuickBooks implements ReceiptGateway {
  private verifiedMapping?: AccountingMapping;
  constructor(public readonly realmId: string, private token: string, private transport: typeof fetch = fetch) {
    if (!/^\d+$/.test(realmId)) throw new Error("Sandbox company required.");
  }
  private async request(path: string, body?: object) {
    const response = await this.transport(`${QB_SANDBOX_BASE}${this.realmId}/${path}`, {
      method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    // Provider error bodies can contain credentials or customer details. Do not log them.
    if (!response.ok) throw new Error(`QuickBooks sandbox returned HTTP ${response.status}.`);
    return response.json();
  }
  async find(docNumber: string): Promise<unknown[]> {
    if (!/^G27-[a-f0-9]{17}$/.test(docNumber)) throw new Error("Invalid accounting reference.");
    const query = `select * from SalesReceipt where DocNumber = '${docNumber}' maxresults 2`;
    const response = await this.request(`query?query=${encodeURIComponent(query)}`);
    if (!response.QueryResponse || (response.QueryResponse.SalesReceipt && !Array.isArray(response.QueryResponse.SalesReceipt)))
      throw new Error("Unrecognized QuickBooks lookup response.");
    return response.QueryResponse.SalesReceipt || [];
  }
  async create(payload: Receipt, requestId: string) {
    if (!/^[a-f0-9-]{36}$/.test(requestId)) throw new Error("Stable order reference required.");
    const mapping = this.verifiedMapping;
    if (!mapping || payload.CustomerRef.value !== mapping.customerId || payload.DepositToAccountRef.value !== mapping.clearingAccountId
      || payload.Line.length !== 1 || payload.Line[0].SalesItemLineDetail.ItemRef.value !== mapping.itemId)
      throw new Error("Frozen receipt no longer matches verified sandbox mapping.");
    // SalesReceipt records an existing payment. Never call Intuit Payments or /send.
    const result = await this.request(`salesreceipt?requestid=${encodeURIComponent(requestId)}`, payload);
    return result.SalesReceipt;
  }
  async verifyMapping(mapping: AccountingMapping) {
    if (mapping.realmId !== this.realmId || Object.values(mapping).some(id => !/^\d+$/.test(id))) throw new Error("Mapping mismatch.");
    const [company, item, income, clearing, customer, prefs] = await Promise.all([
      this.request(`companyinfo/${this.realmId}`), this.request(`item/${mapping.itemId}`),
      this.request(`account/${mapping.incomeAccountId}`), this.request(`account/${mapping.clearingAccountId}`),
      this.request(`customer/${mapping.customerId}`), this.request("preferences"),
    ]);
    if (company.CompanyInfo?.Country !== "US" || prefs.Preferences?.CurrencyPrefs?.HomeCurrency?.value !== "USD"
      || item.Item?.Active !== true || !["Service", "NonInventory"].includes(item.Item?.Type)
      || item.Item?.IncomeAccountRef?.value !== mapping.incomeAccountId
      || income.Account?.Active !== true || !["Income", "Other Income"].includes(income.Account?.AccountType)
      || !/^Symphony Ball(?: Revenue)?$/i.test(income.Account?.Name || "")
      || clearing.Account?.Active !== true || !["Bank", "Other Current Asset"].includes(clearing.Account?.AccountType)
      || customer.Customer?.Active !== true || (customer.Customer?.CurrencyRef?.value || "USD") !== "USD")
      throw new Error("Sandbox company or accounting mapping needs review.");
    this.verifiedMapping = { ...mapping };
  }
}
