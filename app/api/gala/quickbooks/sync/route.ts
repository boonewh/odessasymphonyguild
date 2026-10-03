import { randomUUID } from "node:crypto";
import { z } from "zod";
import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { authorizeDevelopment, backend } from "@/lib/gala/backend/server";
import { readQbConfig, readQbMapping } from "@/lib/gala/backend/qb-config";
import { qbAccessToken, SandboxQuickBooks } from "@/lib/gala/backend/qb-client";
import { AccountingDatabase } from "@/lib/gala/backend/accounting-store";
import { receiptFor, syncReceipt } from "@/lib/gala/backend/accounting";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try { authorizeDevelopment(request, readBackendConfig(process.env).token); }
  catch { return new Response(null, { status: 403 }); }
  if (process.env.GALA_QB_SYNC_ENABLED !== "true") return Response.json({ error: "QuickBooks sandbox writes are disabled." }, { status: 409 });
  try {
    const raw = await request.text(); if (raw.length > 1024) return new Response(null, { status: 413 });
    const { orderId } = z.object({ orderId: z.uuid() }).strict().parse(JSON.parse(raw));
    const config = readQbConfig(process.env), mapping = readQbMapping(process.env);
    const db = new AccountingDatabase(config.url, config.dbKey); await db.verify();
    const owner = randomUUID(); await db.lock(owner);
    try {
      const gateway = new SandboxQuickBooks(config.realmId, await qbAccessToken(config, db, owner));
      await gateway.verifyMapping(mapping);
      const { store, stripe } = await backend();
      const state = await syncReceipt(db, gateway, orderId, owner, async () => {
        const order = await store.get(orderId);
        if (order.status !== "paid" || !order.payment_intent_id) throw new Error("Paid order required.");
        const payment = await stripe.paymentIntents.retrieve(order.payment_intent_id, { expand: ["latest_charge"] });
        const charge = payment.latest_charge;
        if (payment.livemode || payment.status !== "succeeded" || payment.currency !== "usd" || payment.amount_received !== order.amount
          || payment.metadata.gala_order_id !== order.id || payment.metadata.application !== "osg-gala-development"
          || !charge || typeof charge === "string" || charge.status !== "succeeded" || charge.refunded || charge.amount_refunded || charge.disputed)
          throw new Error("Stripe payment needs accounting review.");
        return receiptFor(order, mapping, charge.created);
      });
      return Response.json({ state }, { headers: { "Cache-Control": "no-store" } });
    } finally { await db.unlock(owner); }
  } catch { return Response.json({ error: "Sandbox sync could not be verified. Check setup or retry lookup; uncertain writes are never blindly repeated." }, { status: 409 }); }
}
