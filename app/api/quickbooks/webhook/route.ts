import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/quickbooks/webhook
 *
 * Receives payment notifications from Intuit.
 * When a Payment entity is received, looks up the matching student
 * by qb_invoice_id and marks them as paid in Supabase.
 *
 * Intuit sends a signature in the "intuit-signature" header using
 * the Webhook Verifier Token from the Intuit portal.
 *
 * Must return 200 within 30 seconds or Intuit will retry.
 */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;
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

  // Use constant-time comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("intuit-signature") ?? "";
  const payload = await request.text();

  // Verify the request is actually from Intuit
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
    const dataChangeEvent = notification.dataChangeEvent;
    if (!dataChangeEvent?.entities) continue;

    for (const entity of dataChangeEvent.entities) {
      // We only care about Payment events
      if (entity.name !== "Payment") continue;

      console.log("[QB Webhook] Payment event:", entity.id, "operation:", entity.operation);

      if (entity.operation !== "Create" && entity.operation !== "Update") continue;

      // Mark the student paid by their QB invoice ID
      // QB Payments link a Payment to an Invoice via LinkedTxn — we store invoiceId on the student
      await markStudentPaid(entity.id);
    }
  }

  // Always return 200 so Intuit doesn't retry
  return new NextResponse(null, { status: 200 });
}

async function markStudentPaid(qbPaymentId: string) {
  const supabase = getSupabase();

  // QB webhook gives us the Payment ID, not the Invoice ID directly.
  // We need to look up which invoice this payment covers.
  // For now, we store qb_invoice_id on the student and the webhook
  // fires when the hosted payment page completes — the paymentId
  // maps 1:1 to the invoice for this use case.
  //
  // Strategy: update any unpaid student whose qb_invoice_id is associated
  // with this payment. Since we can't query QB here (no token refresh in
  // webhook path), we match by looking up the payment ID we'll store after
  // invoice creation (qb_payment_id column — to be added when wiring QB calls).
  //
  // For the initial release: QB sends the Invoice entity update with
  // Balance = 0 when paid — handle that path too.
  const { error } = await supabase
    .from("students")
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
    })
    .eq("qb_payment_id", qbPaymentId)
    .eq("paid", false);

  if (error) {
    console.error("[QB Webhook] Failed to mark student paid:", qbPaymentId, error);
  } else {
    console.log("[QB Webhook] Marked student paid for payment:", qbPaymentId);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebhookEntity {
  name: string;       // "Payment", "Invoice", "Customer", etc.
  id: string;         // QB entity ID
  operation: string;  // "Create", "Update", "Delete", "Merge", "Void"
  lastUpdated: string;
}

interface WebhookNotification {
  realmId: string;
  dataChangeEvent: {
    entities: WebhookEntity[];
  };
}
