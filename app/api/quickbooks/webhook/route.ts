import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { loadTokens, saveTokens } from "@/lib/quickbooks/tokens";
import OAuthClient from "intuit-oauth";

/**
 * POST /api/quickbooks/webhook
 *
 * Receives payment notifications from Intuit.
 *
 * Handles two entity types:
 * - Invoice (Update): when Balance reaches 0, mark student paid
 * - Payment (Create/Update): fetch the payment from QB to get the linked
 *   invoice ID, then mark student paid. This is the primary path because
 *   QB does not reliably send Invoice Update events after payment.
 *
 * Must return 200 within 30 seconds or Intuit will retry.
 */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

function verifySignature(payload: string, signature: string): boolean {
  const verifierToken = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
  if (!verifierToken) {
    console.error("[QB Webhook] QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN not set");
    return false;
  }
  const hmac = createHmac("sha256", verifierToken);
  hmac.update(payload);
  const expected = hmac.digest("base64");

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function getAccessToken(): Promise<{ accessToken: string; realmId: string; environment: string } | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  const environment = (process.env.QUICKBOOKS_ENVIRONMENT as "sandbox" | "production") || "sandbox";
  const now = new Date();

  if (tokens.expiresAt <= now) {
    try {
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
      return { accessToken: updated.accessToken, realmId: updated.realmId, environment };
    } catch (err) {
      console.error("[QB Webhook] Token refresh failed:", err);
      return null;
    }
  }

  return { accessToken: tokens.accessToken, realmId: tokens.realmId, environment };
}

async function getInvoiceIdFromPayment(paymentId: string): Promise<string | null> {
  const auth = await getAccessToken();
  if (!auth) {
    console.error("[QB Webhook] No QB tokens available to fetch payment");
    return null;
  }

  const base = auth.environment === "sandbox"
    ? `https://sandbox-quickbooks.api.intuit.com/v3/company/${auth.realmId}`
    : `https://quickbooks.api.intuit.com/v3/company/${auth.realmId}`;

  try {
    const res = await fetch(`${base}/payment/${paymentId}`, {
      headers: {
        Authorization:  `Bearer ${auth.accessToken}`,
        Accept:         "application/json",
      },
    });

    if (!res.ok) {
      console.error("[QB Webhook] Failed to fetch payment:", paymentId, res.status);
      return null;
    }

    const data = await res.json();
    // Lines[].LinkedTxn[] contains the linked invoice
    const lines = data.Payment?.Line ?? [];
    for (const line of lines) {
      for (const txn of (line.LinkedTxn ?? [])) {
        if (txn.TxnType === "Invoice") {
          return txn.TxnId as string;
        }
      }
    }

    console.warn("[QB Webhook] No linked invoice found in payment:", paymentId);
    return null;
  } catch (err) {
    console.error("[QB Webhook] Error fetching payment:", paymentId, err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("intuit-signature") ?? "";
  const payload   = await request.text();

  if (!verifySignature(payload, signature)) {
    console.warn("[QB Webhook] Invalid signature — rejecting request");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!payload.trim()) {
    console.warn("[QB Webhook] Empty payload received");
    return new NextResponse(null, { status: 200 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    // Return 200 to prevent Intuit retry storms
    console.error("[QB Webhook] Failed to parse payload");
    return new NextResponse(null, { status: 200 });
  }

  if (Array.isArray(parsed)) {
    // ── CloudEvents format (new) ──────────────────────────────────────────────
    const events = parsed as CloudEvent[];
    for (const event of events) {
      const parts      = (event.type ?? "").split(".");
      const entityName = parts[1] ?? "";
      const operation  = parts[2] ?? "";
      const entityId   = event.intuitentityid;

      console.log("[QB Webhook] CloudEvent:", event.type, entityId);

      if (entityName === "invoice" && operation === "updated") {
        await markStudentPaidByInvoiceId(entityId);
      }

      if (entityName === "payment" && (operation === "created" || operation === "updated")) {
        console.log("[QB Webhook] Payment event:", entityId, "— fetching linked invoice");
        const invoiceId = await getInvoiceIdFromPayment(entityId);
        if (invoiceId) {
          await markStudentPaidByInvoiceId(invoiceId);
        }
      }
    }
  } else {
    // ── Legacy format (kept during migration window) ──────────────────────────
    const body          = parsed as { eventNotifications?: WebhookNotification[] };
    const notifications = body.eventNotifications ?? [];

    for (const notification of notifications) {
      const entities = notification.dataChangeEvent?.entities ?? [];

      for (const entity of entities) {
        console.log("[QB Webhook] Entity (legacy):", entity.name, entity.operation, entity.id);

        if (entity.name === "Invoice" && entity.operation === "Update") {
          await markStudentPaidByInvoiceId(entity.id);
        }

        if (entity.name === "Payment" && (entity.operation === "Create" || entity.operation === "Update")) {
          console.log("[QB Webhook] Payment received (legacy):", entity.id, "— fetching linked invoice");
          const invoiceId = await getInvoiceIdFromPayment(entity.id);
          if (invoiceId) {
            await markStudentPaidByInvoiceId(invoiceId);
          }
        }
      }
    }
  }

  return new NextResponse(null, { status: 200 });
}

async function markStudentPaidByInvoiceId(qbInvoiceId: string) {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("students")
    .update({
      paid:    true,
      paid_at: new Date().toISOString(),
    })
    .eq("qb_invoice_id", qbInvoiceId)
    .eq("paid", false);

  if (error) {
    console.error("[QB Webhook] Failed to mark student paid for invoice:", qbInvoiceId, error);
  } else {
    console.log("[QB Webhook] Marked student paid for invoice:", qbInvoiceId);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

// CloudEvents format (new — required by May 15, 2026)
interface CloudEvent {
  specversion:     string;
  id:              string;
  source:          string;
  type:            string;  // e.g. "qbo.payment.created.v1"
  datacontenttype: string;
  time:            string;
  intuitentityid:  string;
  intuitaccountid: string;
  data:            Record<string, unknown>;
}

// Legacy format (retained for dual-format support during migration window)
interface WebhookEntity {
  name:        string;
  id:          string;
  operation:   string;
  lastUpdated: string;
}

interface WebhookNotification {
  realmId:         string;
  dataChangeEvent: {
    entities: WebhookEntity[];
  };
}
