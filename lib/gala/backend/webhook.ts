import Stripe from "stripe";
import type { OrderStore } from "./domain";
import { reconcileSession, type StripeGateway } from "./checkout";
const relevant = new Set(["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"]);
export function relevantCheckoutEvent(event: Stripe.Event) { return relevant.has(event.type); }
export async function reconcileCheckoutEvent(store: OrderStore, stripe: StripeGateway, event: Stripe.Event) {
  if (!relevantCheckoutEvent(event)) return "ignored";
  // Delivery order and the event's embedded snapshot are not payment authority.
  return reconcileSession(store, stripe, (event.data.object as Stripe.Checkout.Session).id, event.id);
}
export function parseWebhook(stripe: Stripe, body: string, signature: string, secret: string) {
  const event = stripe.webhooks.constructEvent(body, signature, secret);
  if (event.livemode || event.account) throw new Error("Unexpected event environment.");
  return event;
}
