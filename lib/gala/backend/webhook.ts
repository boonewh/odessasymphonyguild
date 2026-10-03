import Stripe from "stripe";
export function parseWebhook(stripe: Stripe, body: string, signature: string, secret: string) {
  const event = stripe.webhooks.constructEvent(body, signature, secret);
  if (event.livemode || event.account) throw new Error("Unexpected event environment.");
  return event;
}
