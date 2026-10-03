// Read-only Stripe fee evidence for paid Gala orders. No QuickBooks entries,
// payments, or payouts are created. Sandbox fees are not a production quote.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { readBackendConfig, DEVELOPMENT_STRIPE_ACCOUNT } from "../lib/gala/backend/config";
import { SupabaseOrderStore } from "../lib/gala/backend/store";

async function main() {
  const config = readBackendConfig(process.env);
  const store = new SupabaseOrderStore(config.url, config.dbKey); await store.verifyEnvironment();
  const db = createClient(config.url, config.dbKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const stripe = new Stripe(config.key, { maxNetworkRetries: 2, timeout: 20000 });
  if ((await stripe.accounts.retrieveCurrent()).id !== DEVELOPMENT_STRIPE_ACCOUNT) throw new Error("Wrong sandbox.");
  const rows: Array<{ orderId: string; grossCents: number; feeCents: number | null; netCents: number | null; status: string }> = [];
  let cursor: string | undefined;
  const seenCharges = new Set<string>(), seenBalanceTransactions = new Set<string>();
  for (;;) {
    let query = db.from("gala_orders").select("id,amount,currency,payment_intent_id,stripe_session_id")
      .eq("status", "paid").order("id").limit(100);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error || !data) throw new Error("Cannot read paid orders.");
    if (!data.length) break;
    for (const order of data) {
      if (!order.payment_intent_id || !order.stripe_session_id || order.currency !== "usd") throw new Error("Incomplete paid order.");
      const pi = await stripe.paymentIntents.retrieve(order.payment_intent_id, { expand: ["latest_charge.balance_transaction"] });
      const charge = pi.latest_charge;
      if (pi.livemode || pi.status !== "succeeded" || pi.amount_received !== order.amount || pi.currency !== "usd"
        || pi.metadata.gala_order_id !== order.id || pi.metadata.application !== "osg-gala-development"
        || !charge || typeof charge === "string" || charge.status !== "succeeded" || charge.refunded || charge.amount_refunded || charge.disputed)
        throw new Error("Payment needs manual review; audit stopped.");
      if (seenCharges.has(charge.id)) throw new Error("Charge linked to multiple orders.");
      seenCharges.add(charge.id);
      const bt = charge.balance_transaction;
      if (!bt) {
        rows.push({ orderId: order.id, grossCents: order.amount, feeCents: null, netCents: null, status: "balance_transaction_pending" }); continue;
      }
      if (typeof bt === "string" || seenBalanceTransactions.has(bt.id) || bt.currency !== "usd" || bt.amount !== order.amount
        || (typeof bt.source === "string" ? bt.source : bt.source?.id) !== charge.id
        || !Number.isSafeInteger(bt.fee) || !Number.isSafeInteger(bt.net) || bt.amount - bt.fee !== bt.net)
        throw new Error("Balance transaction mismatch; audit stopped.");
      seenBalanceTransactions.add(bt.id);
      rows.push({ orderId: order.id, grossCents: bt.amount, feeCents: bt.fee, netCents: bt.net, status: bt.status });
    }
    cursor = data[data.length - 1].id;
  }
  const complete = rows.every(r => r.feeCents !== null && r.netCents !== null);
  const payouts = await stripe.payouts.list({ limit: 1 });
  console.log(JSON.stringify({ sandbox: true, currency: "USD", generatedAt: new Date().toISOString(),
    paidOrders: rows.length, grossCents: rows.reduce((sum, r) => sum + r.grossCents, 0),
    feeCents: complete ? rows.reduce((sum, r) => sum + r.feeCents!, 0) : null,
    netCents: complete ? rows.reduce((sum, r) => sum + r.netCents!, 0) : null,
    allFeesAvailable: complete, sandboxPayoutExists: payouts.data.length > 0,
    payoutReconciled: false, quickBooksFeeOrPayoutWrites: false, orders: rows }, null, 2));
}
main().catch(() => { console.error("Sandbox fee audit stopped; inspect provider/order state. Credentials were not printed."); process.exitCode = 1; });
