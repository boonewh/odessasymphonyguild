import Stripe from "stripe";
import { readBackendConfig } from "@/lib/gala/backend/config";
import { verifyStripeAccount } from "@/lib/gala/backend/payment-mode";
import { authorizeScheduledRecovery, scheduledRecoveryEnabled } from "@/lib/gala/backend/scheduled-recovery";
import { SupabaseOrderStore } from "@/lib/gala/backend/store";
import { SupabaseRecoveryStore } from "@/lib/gala/backend/recovery-store";
import { recoveryPass } from "@/lib/gala/backend/recovery";
import { patronPaymentsEnabled } from "@/lib/patron/payment-config";
import { recoverPatronPayments } from "@/lib/patron/payment";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  if (!scheduledRecoveryEnabled(process.env)) return new Response(null, { status: 404 });
  const headers = { "Cache-Control": "no-store" };
  if (!authorizeScheduledRecovery(request, process.env)) return new Response(null, { status: 401, headers });
  try {
    const config = readBackendConfig(process.env);
    const stripe = new Stripe(config.key, { maxNetworkRetries: 0, timeout: 10_000 });
    verifyStripeAccount((await stripe.accounts.retrieveCurrent()).id, config.paymentMode);
    const store = new SupabaseOrderStore(config.url, config.dbKey);
    await store.verifyEnvironment(config.paymentMode);
    const queue = new SupabaseRecoveryStore(config.url, config.dbKey);
    // Shared database leases make overlapping scheduler calls safe. A terminated
    // invocation leaves its lease/hold intact for the next scheduled pass.
    const result = await recoveryPass(queue, store, stripe, 5, 90_000, config.paymentMode);
    if (!patronPaymentsEnabled()) return Response.json(result, { headers });
    // Patron failures must not prevent Gala's recovery work or heartbeat.
    try {
      const { getPatronPaymentStore } = await import("@/lib/patron/payment-store");
      const patrons = await recoverPatronPayments(await getPatronPaymentStore(), stripe, config.paymentMode);
      return Response.json({ ...result, patrons }, { headers });
    } catch { return Response.json({ ...result, patronRecovery: "retry_required" }, { headers }); }
  } catch {
    return Response.json({ error: "Payment check failed; reservations remain protected." }, { status: 503, headers });
  }
}
