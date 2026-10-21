import type Stripe from "stripe";
import { paymentEnvironment, type PaymentMode } from "../gala/backend/payment-mode";

export const PATRON_DUES_CENTS = 10000;
export type PatronPayment = {
  id: string; patron_id: string; owner_hash: string; mode: PaymentMode; amount: number; currency: string;
  status: "pending" | "paid" | "expired"; email: string; period: string; origin: string;
  stripe_session_id: string | null; stripe_payment_id: string | null; created_at: string; checked_at: string | null; paid_at: string | null;
};
export interface PatronPaymentStore {
  start(input: Record<string, unknown>): Promise<PatronPayment>;
  get(id: string): Promise<PatronPayment | null>;
  apply(id: string, session: string, status: PatronPayment["status"], payment: string | null): Promise<void>;
  pending(): Promise<PatronPayment[]>;
  touched(id: string): Promise<void>;
}
export type PatronStripe = Pick<Stripe, "checkout" | "paymentIntents">;
export const patronApplication = (mode: PaymentMode) => mode === "live" ? "osg-patron-dues" : "osg-patron-dues-test";
export function isPatronCheckout(event: Stripe.Event) {
  return ["osg-patron-dues", "osg-patron-dues-test"].includes((event.data.object as Stripe.Checkout.Session).metadata?.application || "");
}
export function patronSessionParameters(payment: PatronPayment): Stripe.Checkout.SessionCreateParams {
  const metadata = { application: patronApplication(payment.mode), patron_payment_id: payment.id };
  return {
    mode: "payment", ui_mode: "hosted_page", allowed_payment_method_types: ["card"],
    wallet_options: { link: { display: "never" } },
    customer_email: payment.email, client_reference_id: payment.id, metadata,
    payment_intent_data: { metadata },
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: PATRON_DUES_CENTS,
      product_data: { name: `Odessa Symphony Guild Patron dues · ${payment.period}` } } }],
    expires_at: Math.floor(Date.parse(payment.created_at) / 1000) + 35 * 60,
    success_url: `${payment.origin}/patron/payment?payment=${payment.id}`,
    cancel_url: `${payment.origin}/patron/payment?payment=${payment.id}&cancelled=true`,
    after_expiration: { recovery: { enabled: false } }, adaptive_pricing: { enabled: false },
  };
}
export function verifyPatronSession(payment: PatronPayment, session: Stripe.Checkout.Session, mode: PaymentMode) {
  if (payment.mode !== mode || payment.amount !== PATRON_DUES_CENTS || payment.currency !== "usd"
    || session.livemode !== paymentEnvironment(mode).livemode || !session.id.startsWith(paymentEnvironment(mode).sessionPrefix)
    || session.mode !== "payment" || session.currency !== "usd" || session.amount_total !== payment.amount
    || session.client_reference_id !== payment.id || session.metadata?.patron_payment_id !== payment.id
    || session.metadata?.application !== patronApplication(mode) || session.recovered_from
    || (payment.stripe_session_id && payment.stripe_session_id !== session.id)) throw new Error("patron_payment_mismatch");
}
export async function reconcilePatronSession(store: PatronPaymentStore, stripe: PatronStripe, sessionId: string, mode: PaymentMode) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.application !== patronApplication(mode)) throw new Error("patron_payment_mismatch");
  const payment = await store.get(session.metadata.patron_payment_id || "");
  if (!payment) throw new Error("patron_payment_missing");
  verifyPatronSession(payment, session, mode);
  const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  let state: PatronPayment["status"] = "pending";
  if (session.status === "complete" && session.payment_status === "paid" && paymentId) {
    const intent = await stripe.paymentIntents.retrieve(paymentId);
    if (intent.id !== paymentId || intent.livemode !== paymentEnvironment(mode).livemode || intent.currency !== "usd"
      || intent.amount !== payment.amount || intent.amount_received !== payment.amount || intent.status !== "succeeded"
      || intent.metadata.application !== patronApplication(mode) || intent.metadata.patron_payment_id !== payment.id)
      throw new Error("patron_payment_mismatch");
    state = "paid";
  } else if (session.status === "expired" && session.payment_status === "unpaid") {
    if (paymentId) {
      const intent = await stripe.paymentIntents.retrieve(paymentId);
      if (intent.id !== paymentId || intent.livemode !== paymentEnvironment(mode).livemode || intent.currency !== "usd"
        || intent.amount !== payment.amount || intent.metadata.application !== patronApplication(mode)
        || intent.metadata.patron_payment_id !== payment.id) throw new Error("patron_payment_mismatch");
      if (intent.status !== "canceled" || intent.amount_received !== 0) return { payment, session };
    }
    state = "expired";
  }
  await store.apply(payment.id, session.id, state, state === "paid" ? paymentId! : null);
  return { payment: (await store.get(payment.id))!, session };
}
export async function openPatronCheckout(store: PatronPaymentStore, stripe: PatronStripe, payment: PatronPayment, mode: PaymentMode, now = Date.now()) {
  if (payment.mode !== mode) throw new Error("patron_payment_mismatch");
  if (payment.status !== "pending") return { payment, url: null };
  let session: Stripe.Checkout.Session;
  if (payment.stripe_session_id) session = await stripe.checkout.sessions.retrieve(payment.stripe_session_id);
  else {
    // A fixed payload/key recovers response loss without another charge. Never
    // recreate old ambiguous attempts after Stripe's idempotency retention.
    if (now - Date.parse(payment.created_at) > 4 * 60_000) throw new Error("patron_payment_review");
    session = await stripe.checkout.sessions.create(patronSessionParameters(payment), { idempotencyKey: `patron-dues-${payment.id}` });
  }
  verifyPatronSession(payment, session, mode);
  const result = await reconcilePatronSession(store, stripe, session.id, mode);
  const url = session.status === "open" ? session.url : null;
  if (url && new URL(url).origin !== "https://checkout.stripe.com") throw new Error("patron_payment_mismatch");
  return { payment: result.payment, url };
}
export async function recoverPatronPayments(store: PatronPaymentStore, stripe: PatronStripe, mode: PaymentMode) {
  const results: { id: string; status: string }[] = [];
  const deadline = Date.now() + 60_000;
  for (const payment of await store.pending()) {
    if (Date.now() >= deadline) break;
    try {
      if (payment.mode !== mode) throw new Error("patron_payment_mismatch");
      let sessionId = payment.stripe_session_id;
      if (!sessionId) {
        // A create response may have been lost before its ID reached SQL. Read
        // provider records; never issue a fresh old Checkout creation request.
        let after: string | undefined;
        for (let page = 0; page < 10 && !sessionId; page++) {
          if (Date.now() >= deadline) break;
          const sessions = await stripe.checkout.sessions.list({ limit: 100, starting_after: after,
            created: { gte: Math.floor(Date.parse(payment.created_at) / 1000) - 60, lte: Math.floor(Date.parse(payment.created_at) / 1000) + 300 } });
          const match = sessions.data.find(session => session.metadata?.application === patronApplication(mode) && session.metadata.patron_payment_id === payment.id);
          if (match) sessionId = match.id;
          if (!sessions.has_more) break;
          after = sessions.data.at(-1)?.id;
        }
      }
      const result = sessionId ? await reconcilePatronSession(store, stripe, sessionId, mode) : null;
      results.push({ id: payment.id, status: result?.payment.status || "needs_review" });
    } catch { results.push({ id: payment.id, status: "retry_required" }); }
    finally { await store.touched(payment.id); }
  }
  return results;
}
