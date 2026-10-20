import Stripe from "stripe";
import type { OrderStore } from "./domain";
import { reconcileSession, type StripeGateway } from "./checkout";
import { paymentEnvironment, type PaymentMode } from "./payment-mode";
const relevant = new Set(["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"]);
export function relevantCheckoutEvent(event: Stripe.Event) { return relevant.has(event.type); }
export async function reconcileCheckoutEvent(store: OrderStore, stripe: StripeGateway, event: Stripe.Event, mode: PaymentMode = "sandbox") {
  if (!relevantCheckoutEvent(event)) return "ignored";
  // Delivery order and the event's embedded snapshot are not payment authority.
  return reconcileSession(store, stripe, (event.data.object as Stripe.Checkout.Session).id, event.id, mode);
}
export function parseWebhook(stripe: Stripe, body: string, signature: string, secret: string, mode: PaymentMode = "sandbox") {
  const event = stripe.webhooks.constructEvent(body, signature, secret);
  if (event.livemode !== paymentEnvironment(mode).livemode || event.account) throw new Error("Unexpected event environment.");
  return event;
}
