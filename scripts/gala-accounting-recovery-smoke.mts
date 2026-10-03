// Explicitly authorized sandbox test only. Consumes one fresh, paid gift order's
// pending accounting job. It never resets a dispatch marker or creates a payment.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readQbConfig, readQbMapping } from "../lib/gala/backend/qb-config";
import { DEVELOPMENT_STRIPE_ACCOUNT } from "../lib/gala/backend/config";
import { AccountingDatabase } from "../lib/gala/backend/accounting-store";
import { SupabaseOrderStore } from "../lib/gala/backend/store";
import { qbAccessToken, SandboxQuickBooks } from "../lib/gala/backend/qb-client";
import { receiptFor, syncReceipt, verifyReceipt, type AccountingStore, type ReceiptGateway } from "../lib/gala/backend/accounting";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  check(process.env.GALA_QB_RECOVERY_TEST === "true", "Explicit recovery-test opt-in required.");
  const id = process.argv[2];
  check(/^[a-f0-9-]{36}$/.test(id || ""), "Supply the authorized paid sandbox gift order UUID.");
  const config = readQbConfig(process.env), mapping = readQbMapping(process.env);
  const db = new AccountingDatabase(config.url, config.dbKey); await db.verify();
  const orders = new SupabaseOrderStore(config.url, config.dbKey); await orders.verifyEnvironment();
  const supabase = createClient(config.url, config.dbKey, { auth: { persistSession: false, autoRefreshToken: false } });
  async function job() {
    const { data, error } = await supabase.from("gala_accounting_outbox")
      .select("status,payload,realm_id,dispatched_at,receipt_id,attempts,lease_until").eq("order_id", id).single();
    check(!error && data, "Cannot read accounting job."); return data;
  }
  const order = await orders.get(id), initial = await job();
  check(order.status === "paid" && order.details.kind === "gifts" && order.payment_intent_id && order.stripe_session_id,
    "A verified paid gift order is required.");
  check(initial.status === "pending" && !initial.payload && !initial.dispatched_at && !initial.receipt_id
    && !initial.lease_until && initial.attempts === 0, "Order has already entered accounting; inspect it before any further test.");
  const beforeInventory = JSON.stringify((await orders.dashboard()).inventory.sort((a, b) => a.tier.localeCompare(b.tier)));
  const stripe = new Stripe(config.key, { maxNetworkRetries: 2, timeout: 20000 });
  check((await stripe.accounts.retrieveCurrent()).id === DEVELOPMENT_STRIPE_ACCOUNT, "Unexpected Stripe sandbox account.");
  const payment = await stripe.paymentIntents.retrieve(order.payment_intent_id, { expand: ["latest_charge"] });
  const charge = payment.latest_charge;
  check(!payment.livemode && payment.status === "succeeded" && payment.currency === "usd" && payment.amount_received === order.amount
    && payment.metadata.gala_order_id === id && payment.metadata.application === "osg-gala-development"
    && charge && typeof charge !== "string" && charge.status === "succeeded" && !charge.refunded && !charge.amount_refunded && !charge.disputed,
    "Stripe payment does not qualify for the recovery test.");
  const payload = receiptFor(order, mapping, charge.created);
  const owner = randomUUID(); await db.lock(owner);
  try {
    const gateway = new SandboxQuickBooks(config.realmId, await qbAccessToken(config, db, owner));
    await gateway.verifyMapping(mapping);
    check((await gateway.find(payload.DocNumber)).length === 0, "Receipt already exists; refusing to start failure injection.");
    let creates = 0;
    const tracked: ReceiptGateway = {
      realmId: config.realmId,
      find: doc => gateway.find(doc),
      create: async (receipt, requestId) => { creates++; return gateway.create(receipt, requestId); },
    };
    const prepare = async () => payload;
    // Inject a lookup outage before dispatch. The real hosted job must remain safe to retry.
    const unavailable: ReceiptGateway = { ...tracked, find: async () => { throw new Error("Injected lookup outage"); } };
    check(await syncReceipt(db, unavailable, id, owner, prepare) === "review", "Lookup outage did not enter review.");
    let current = await job();
    check(!current.dispatched_at && Number(creates) === 0 && (await orders.get(id)).status === "paid", "Lookup outage changed payment or dispatched a sale.");
    console.log("PASS: injected lookup outage retained paid status and made no receipt POST.");

    // Intuit receives the real POST, but the worker never receives its success response.
    const lostResponse: ReceiptGateway = { ...tracked, create: async (receipt, requestId) => {
      await tracked.create(receipt, requestId); throw new Error("Injected lost provider response");
    } };
    check(await syncReceipt(db, lostResponse, id, owner, prepare) === "review", "Lost response did not enter review.");
    current = await job();
    const saved = await gateway.find(payload.DocNumber);
    check(saved.length === 1 && current.dispatched_at && !current.receipt_id && creates === 1, "Expected one receipt and durable uncertain dispatch.");
    const receiptId = verifyReceipt(saved[0], payload);
    check((await orders.get(id)).status === "paid", "Lost response changed paid status.");
    console.log(JSON.stringify({ test: "lost_response", status: current.status, receiptId, receiptCount: saved.length, amount: order.amount / 100 }));

    // Lookup finds the existing receipt; emulate failure to save the success locally.
    const failedSave: AccountingStore = {
      claim: (a, b) => db.claim(a, b), prepare: (a, b, c, d) => db.prepare(a, b, c, d),
      dispatch: (a, b) => db.dispatch(a, b), review: (a, b, c) => db.review(a, b, c),
      finish: async () => { throw new Error("Injected database save failure"); },
    };
    check(await syncReceipt(failedSave, tracked, id, owner, prepare) === "review", "Save failure did not enter review.");
    check(creates === 1 && !(await job()).receipt_id, "Save failure caused a second POST or claimed success.");
    console.log("PASS: injected database-save failure kept the job in review without another receipt POST.");

    check(await syncReceipt(db, tracked, id, owner, prepare) === "synced", "Lookup recovery failed.");
    check(await syncReceipt(db, tracked, id, owner, prepare) === "busy_or_synced", "Successful retry did not stop.");
    current = await job();
    const final = await gateway.find(payload.DocNumber);
    check(final.length === 1 && verifyReceipt(final[0], payload) === receiptId && current.receipt_id === receiptId
      && current.status === "synced" && creates === 1, "Recovery duplicated or changed the receipt.");
    check(JSON.stringify(await orders.get(id)) === JSON.stringify(order), "Gift order or recipient details changed.");
    check(JSON.stringify((await orders.dashboard()).inventory.sort((a, b) => a.tier.localeCompare(b.tier))) === beforeInventory, "Inventory changed.");
    console.log(JSON.stringify({ test: "recovered", status: current.status, receiptId, receiptCount: final.length,
      receiptPosts: creates, workerAttempts: current.attempts, amount: order.amount / 100, date: payload.TxnDate,
      salesLines: payload.Line.length, description: payload.Line[0].Description, recipientDetailsPreserved: true, inventoryUnchanged: true }));
  } finally { await db.unlock(owner); }
}
main().catch(() => {
  console.error("Sandbox recovery test stopped. Inspect the paid order/outbox before retrying; do not reset dispatch markers. Credentials were not printed.");
  process.exitCode = 1;
});
