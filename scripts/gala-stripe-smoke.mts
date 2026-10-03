// Explicit sandbox-only check. Uses an ephemeral PostgreSQL database, not hosted records.
// Run: node --env-file=.env.local --import tsx scripts/gala-stripe-smoke.mts
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { testDatabase } from "../tests/helpers/gala-database.mjs";
import { priceRequest } from "../lib/gala/backend/domain";
import { startCheckout, sessionParameters, reconcileSession } from "../lib/gala/backend/checkout";
import { DEVELOPMENT_STRIPE_ACCOUNT } from "../lib/gala/backend/config";

async function main() {
  const key = process.env.GALA_STRIPE_SECRET_KEY || "";
  if (!/^(sk|rk)_test_\S+$/.test(key)) throw new Error("Sandbox key required");
  const stripe = new Stripe(key, { maxNetworkRetries: 2, timeout: 20000 });
  if ((await stripe.accounts.retrieveCurrent()).id !== DEVELOPMENT_STRIPE_ACCOUNT) throw new Error("Unexpected account");
  const { db, store } = await testDatabase();
  let sessionId: string | undefined;
  try {
    const input = { requestId: randomUUID(), kind: "tables", allSalesFinal: true,
      contact: { name: "Fictional Gala Test", email: "gala-sandbox@example.com", phone: "4325550100" },
      purchase: { product: "gold", quantity: 1, extraSeats: 2 } };
    const result = await startCheckout(store, stripe, input, "http://localhost:3000");
    const order = await store.get(result.orderId);
    sessionId = order.stripe_session_id;
    const repeated = await stripe.checkout.sessions.create(sessionParameters(order, "http://localhost:3000"),
      { idempotencyKey: `gala-checkout-${order.id}` });
    if (repeated.id !== sessionId || repeated.amount_total !== 437500 || repeated.livemode) throw new Error("Idempotency or amount mismatch");
    console.log("PASS: actual Stripe sandbox hosted checkout, $4,375 total, repeated creation returns one session.");
    await stripe.checkout.sessions.expire(sessionId!, {}, { idempotencyKey: `gala-expire-${order.id}` });
    const state = await reconcileSession(store, stripe, sessionId!, `smoke-${order.id}`);
    await reconcileSession(store, stripe, sessionId!, `smoke-${order.id}`);
    if (state !== "expired" || (await store.get(order.id)).status !== "expired") throw new Error("Expiry not applied");
    console.log("PASS: provider-confirmed expiration releases the test hold; repeated reconciliation is harmless.");
    if ((await db.query("select * from gala_accounting_outbox")).rows.length) throw new Error("Unpaid accounting entry");
    console.log("PASS: unpaid checkout creates no accounting entry. No card was charged.");
  } finally {
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);
    }
    await db.close();
  }
}
main().catch((error: unknown) => {
  // SDK errors can contain request details. Output only a safe type/code, never raw errors.
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "check_failed";
  console.error(`Sandbox smoke check failed (${/^[a-z_]+$/.test(code) ? code : "check_failed"}).`);
  if (error instanceof Error) {
    const message = error.message.replace(/(?:sk|rk|pk)_(?:test|live)_\S+/g, "[redacted]")
      .replace(/sb_secret_\S+/g, "[redacted]");
    console.error(message.slice(0, 500));
  }
  process.exitCode = 1;
});
