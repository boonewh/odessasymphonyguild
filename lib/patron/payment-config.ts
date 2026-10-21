import { patronEnabled } from "./config";
import { liveSiteEnabled } from "../gala/live-release";
import { readBackendConfig } from "../gala/backend/config";

// Processing remains enabled when checkout is paused. No Preview/live mixing.
export function patronPaymentsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return patronEnabled(env) && (liveSiteEnabled(env) ? env.PATRON_STRIPE_ENABLED === "true" : env.PATRON_STRIPE_ENABLED !== "false");
}
export function patronCheckoutOpen(env: NodeJS.ProcessEnv = process.env) {
  return patronPaymentsEnabled(env) && (liveSiteEnabled(env) ? env.PATRON_CARD_PAYMENTS_OPEN === "true" : env.PATRON_CARD_PAYMENTS_OPEN !== "false");
}
export function patronPaymentConfig() {
  if (!patronPaymentsEnabled()) throw new Error("Patron payments unavailable.");
  // Reuse the existing OSG Stripe account, credentials and canonical origin.
  return readBackendConfig(process.env);
}
