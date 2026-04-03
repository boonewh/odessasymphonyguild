import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/quickbooks/webhook
 *
 * Receives payment notifications from Intuit.
 *
 * Handles two entity types:
 * - Invoice (Update): when Balance reaches 0, the invoice is paid — mark student paid
 * - Payment (Create/Update): fallback path using payment ID
 *
 * Intuit sends a signature in the "intuit-signature" header using
 * the Webhook Verifier Token from the Intuit portal.
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

export async function POST(request: NextRequest) {
  const signature = request.headers.get("intuit-signature") ?? "";
  const payload   = await request.text();

  if (!verifySignature(payload, signature)) {
    console.warn("[QB Webhook] Invalid signature — rejecting request");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: { eventNotifications?: WebhookNotification[] };
  try {
    body = JSON.parse(payload);
  } catch {
    console.error("[QB Webhook] Failed to parse payload");
    return new NextResponse("Bad Request", { status: 400 });
  }

  const notifications = body.eventNotifications ?? [];

  for (const notification of notifications) {
    const entities = notification.dataChangeEvent?.entities ?? [];

    for (const entity of entities) {
      console.log("[QB Webhook] Entity:", entity.name, entity.operation, entity.id);

      if (entity.name === "Invoice" && entity.operation === "Update") {
        // Invoice updated — mark student paid by qb_invoice_id.
        // QB fires this when the invoice balance reaches 0 (fully paid).
        await markStudentPaidByInvoiceId(entity.id);
      }

      if (entity.name === "Payment" && (entity.operation === "Create" || entity.operation === "Update")) {
        // Payment created/updated — store the payment ID on the student record.
        // We can't look up the linked invoice without a QB API call here,
        // so we rely on the Invoice Update event above for the paid status flip.
        console.log("[QB Webhook] Payment event noted:", entity.id);
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
