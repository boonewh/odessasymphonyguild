import OAuthClient from "intuit-oauth";
import { loadTokens, saveTokens } from "./tokens";
import { getMockQuickBooksClient } from "./mock";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";

export interface StudentInvoiceInput {
  studentName: string;
  parentName:  string;
  primaryEmail:      string;
  additionalEmails:  string[];
  amount:      number;
}

export interface StudentInvoiceResult {
  customerId:  string;
  invoiceId:   string;
  paymentLink: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getTokens() {
  const tokens = await loadTokens();
  if (!tokens) throw new Error("QuickBooks not connected. Please authorize the connection first.");

  const environment = (process.env.QUICKBOOKS_ENVIRONMENT as "sandbox" | "production") || "sandbox";
  const now = new Date();

  // Refresh access token if expired
  if (tokens.expiresAt <= now) {
    const oauthClient = new OAuthClient({
      clientId:     process.env.QUICKBOOKS_CLIENT_ID!,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
      environment,
      redirectUri:  process.env.QUICKBOOKS_REDIRECT_URI!,
    });

    oauthClient.setToken({
      access_token:               tokens.accessToken,
      refresh_token:              tokens.refreshToken,
      token_type:                 "bearer",
      expires_in:                 0,
      x_refresh_token_expires_in: Math.floor((tokens.refreshExpiresAt.getTime() - now.getTime()) / 1000),
    });

    const refreshed = await oauthClient.refresh();
    const t = refreshed.token;
    const updated = {
      realmId:          tokens.realmId,
      accessToken:      t.access_token,
      refreshToken:     t.refresh_token,
      expiresAt:        new Date(Date.now() + t.expires_in * 1000),
      refreshExpiresAt: new Date(Date.now() + t.x_refresh_token_expires_in * 1000),
    };
    await saveTokens(updated);
    console.log("[QB] Access token refreshed.");
    return { ...updated, environment };
  }

  return { ...tokens, environment };
}

async function qbRequest<T>(
  path: string,
  method: "GET" | "POST",
  accessToken: string,
  realmId: string,
  environment: string,
  body?: unknown
): Promise<T> {
  const base =
    environment === "sandbox"
      ? `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}`
      : `https://quickbooks.api.intuit.com/v3/company/${realmId}`;

  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept:         "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const intuitTid = res.headers.get("intuit_tid");

  if (!res.ok) {
    const text = await res.text();
    console.error(`[QB] ${method} ${path} failed`, { status: res.status, intuit_tid: intuitTid, body: text });
    throw new Error(`QB API error ${res.status}: ${text}`);
  }

  if (intuitTid) console.log(`[QB] ${method} ${path} — intuit_tid: ${intuitTid}`);
  return res.json();
}

// ── Main service function ─────────────────────────────────────────────────────

export async function createStudentInvoice(
  input: StudentInvoiceInput
): Promise<StudentInvoiceResult> {
  // ── Mock mode ──────────────────────────────────────────────────────────────
  if (process.env.MOCK_PAYMENT_MODE === "true") {
    const mock = getMockQuickBooksClient();
    const customer = await mock.findOrCreateCustomer({
      firstName: input.parentName.split(" ")[0],
      lastName:  input.parentName.split(" ").slice(1).join(" ") || "Parent",
      email:     input.primaryEmail,
    });
    const invoice = await mock.createInvoice({
      customerId:  customer.Id!,
      amount:      input.amount,
      description: `${BELLES_BEAUX_CONFIG.schoolYear} Belles & Beaux Dues — ${input.studentName}`,
    });
    return {
      customerId:  customer.Id!,
      invoiceId:   invoice.Id!,
      paymentLink: invoice.InvoiceLink ?? null,
    };
  }

  // ── Real QB ────────────────────────────────────────────────────────────────
  const { accessToken, realmId, environment } = await getTokens();

  // 1. Find or create QB customer by primary email
  const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${input.primaryEmail}' MAXRESULTS 1`;
  const searchRes = await qbRequest<{
    QueryResponse: { Customer?: Array<{ Id: string }> };
  }>(`/query?query=${encodeURIComponent(query)}`, "GET", accessToken, realmId, environment);

  let customerId: string;
  const existing = searchRes.QueryResponse.Customer?.[0];

  if (existing) {
    customerId = existing.Id;
    console.log("[QB] Found existing customer:", customerId);
  } else {
    const [firstName, ...rest] = input.parentName.split(" ");
    const lastName = rest.join(" ") || input.studentName.split(" ").slice(-1)[0];

    const customerRes = await qbRequest<{ Customer: { Id: string } }>(
      "/customer", "POST", accessToken, realmId, environment,
      {
        GivenName:        firstName,
        FamilyName:       lastName,
        DisplayName:      `${input.parentName} (${input.studentName})`,
        PrimaryEmailAddr: { Address: input.primaryEmail },
      }
    );
    customerId = customerRes.Customer.Id;
    console.log("[QB] Created customer:", customerId);
  }

  // 2. Create invoice
  const itemId  = process.env.QB_ITEM_ID || "1";
  const today   = new Date().toISOString().split("T")[0];
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const description = `${BELLES_BEAUX_CONFIG.schoolYear} Belles & Beaux Dues — ${input.studentName}`;

  const invoiceRes = await qbRequest<{
    Invoice: { Id: string; InvoiceLink?: string };
  }>(
    "/invoice", "POST", accessToken, realmId, environment,
    {
      CustomerRef:                 { value: customerId },
      AllowOnlinePayment:          true,
      AllowOnlineCreditCardPayment: true,
      AllowOnlineACHPayment:       true,
      BillEmail:                   { Address: input.primaryEmail },
      TxnDate:                     today,
      DueDate:                     dueDate,
      CustomerMemo:                { value: description },
      Line: [
        {
          Amount:      input.amount,
          Description: description,
          DetailType:  "SalesItemLineDetail",
          SalesItemLineDetail: {
            ItemRef:    { value: itemId },
            UnitPrice:  input.amount,
            Qty:        1,
          },
        },
      ],
    }
  );

  const invoiceId   = invoiceRes.Invoice.Id;
  const paymentLink = invoiceRes.Invoice.InvoiceLink ?? null;
  console.log("[QB] Created invoice:", invoiceId, paymentLink ? "with payment link" : "no payment link");

  // 3. Send to additional parent email if provided
  for (const email of input.additionalEmails) {
    try {
      await qbRequest(
        `/invoice/${invoiceId}/send?sendTo=${encodeURIComponent(email)}`,
        "POST", accessToken, realmId, environment
      );
      console.log("[QB] Invoice sent to:", email);
    } catch (err) {
      console.error("[QB] Failed to send invoice to:", email, err);
    }
  }

  return { customerId, invoiceId, paymentLink };
}
