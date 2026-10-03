import type Stripe from "stripe";
import { priceRequest, type Order, type OrderStore } from "./domain";

export type StripeGateway = Pick<Stripe, "checkout" | "paymentIntents">;
// DEVELOPMENT ONLY. Final checkout duration still needs board approval.
export const DEVELOPMENT_CHECKOUT_SECONDS = 35 * 60;
export function sessionParameters(order: Order, origin: string): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment", ui_mode: "hosted_page", allowed_payment_method_types: ["card"],
    // Link can offer bank/financing methods even with card-only Checkout.
    wallet_options: { link: { display: "never" } },
    client_reference_id: order.id,
    metadata: { gala_order_id: order.id, application: "osg-gala-development" },
    payment_intent_data: { metadata: { gala_order_id: order.id, application: "osg-gala-development" } },
    customer_email: order.details.contact.email,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: order.amount,
      product_data: { name: order.description } } }],
    expires_at: Math.floor(Date.parse(order.created_at) / 1000) + DEVELOPMENT_CHECKOUT_SECONDS,
    success_url: `${origin}/gala/preview/payment?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/gala/preview/payment?order_id=${order.id}&cancelled=true`,
    custom_text: { submit: { message: "All sales are final. No refunds." } },
    // Recovery must stay off: it could create a payable copy after inventory is released.
    after_expiration: { recovery: { enabled: false } },
    adaptive_pricing: { enabled: false },
  };
}
export function verifySession(order: Order, session: Stripe.Checkout.Session) {
  if (session.livemode || session.mode !== "payment" || session.currency !== "usd"
    || session.amount_total !== order.amount || session.client_reference_id !== order.id
    || session.metadata?.gala_order_id !== order.id || session.metadata?.application !== "osg-gala-development"
    || session.recovered_from || (order.stripe_session_id && order.stripe_session_id !== session.id))
    throw new Error("Checkout does not match the reserved order.");
}
export async function startCheckout(store: OrderStore, stripe: StripeGateway, raw: unknown, origin: string, now = Date.now()) {
  const order = await store.reserve(priceRequest(raw));
  if (order.status === "paid" || order.status === "expired") throw new Error("This order is already closed.");
  let session: Stripe.Checkout.Session;
  if (order.stripe_session_id) session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
  else {
    // A fixed payload + key can be retried safely. Never recreate an old ambiguous attempt
    // after Stripe may have pruned its idempotency record. Retain its inventory for review.
    if (now - Date.parse(order.created_at) > 4 * 60_000) throw new Error("Checkout creation needs reconciliation.");
    session = await stripe.checkout.sessions.create(sessionParameters(order, origin), { idempotencyKey: `gala-checkout-${order.id}` });
  }
  verifySession(order, session);
  await store.bind(order.id, session.id);
  if (session.status !== "open" || !session.url) throw new Error("Checkout is no longer open; reconcile its payment status.");
  return { orderId: order.id, url: session.url };
}
export async function reconcileSession(store: OrderStore, stripe: StripeGateway, sessionId: string, eventId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.application !== "osg-gala-development") return "unrelated";
  const order = await store.get(session.metadata.gala_order_id!);
  verifySession(order, session);
  const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (session.status === "complete" && session.payment_status === "paid" && paymentId) {
    const payment = await stripe.paymentIntents.retrieve(paymentId);
    if (payment.livemode || payment.status !== "succeeded" || payment.currency !== "usd"
      || payment.amount !== order.amount || payment.amount_received !== order.amount
      || payment.metadata.gala_order_id !== order.id || payment.metadata.application !== "osg-gala-development")
      throw new Error("Payment does not match the reserved order.");
    await store.apply(order.id, session.id, "paid", payment.id, eventId);
    return "paid";
  }
  if (session.status === "expired" && session.payment_status === "unpaid") {
    if (paymentId) {
      const payment = await stripe.paymentIntents.retrieve(paymentId);
      if (payment.livemode || payment.status !== "canceled") return "pending";
    }
    await store.apply(order.id, session.id, "expired", null, eventId);
    return "expired";
  }
  // A complete-but-unpaid session, failed attempt, or uncertain provider status holds stock.
  return "pending";
}
export async function reconcilePending(store: OrderStore, stripe: StripeGateway, now = Date.now()) {
  const results: { orderId: string; state: string }[] = [];
  for (const order of await store.pending()) {
    if (!order.stripe_session_id) { results.push({ orderId: order.id, state: "creation_needs_review" }); continue; }
    try {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      verifySession(order, session);
      if (session.status === "open" && now >= Date.parse(order.created_at) + DEVELOPMENT_CHECKOUT_SECONDS * 1000)
        await stripe.checkout.sessions.expire(session.id, {}, { idempotencyKey: `gala-expire-${order.id}` });
      const state = await reconcileSession(store, stripe, session.id, `reconcile-${session.id}`);
      results.push({ orderId: order.id, state });
    } catch { results.push({ orderId: order.id, state: "retry_required" }); }
  }
  return results;
}
