import { checkoutRequest, type CheckoutRequest } from "./checkout-request";
// One unresolved purchase per tab, shared by both flyer forms. Never clear an
// uncertain attempt automatically: its reservation may already exist remotely.
export const FLYER_ATTEMPT_KEY = "osg-gala-flyer-checkout-v1";
export function readAttempt(raw: string | null): CheckoutRequest | null {
  return raw === null ? null : checkoutRequest.parse(JSON.parse(raw));
}
export function checkoutUrl(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("Stripe checkout URL is missing.");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.username || url.password)
    throw new Error("Unexpected checkout destination.");
  return url.href;
}
