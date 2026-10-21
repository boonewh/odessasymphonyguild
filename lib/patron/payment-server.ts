import "server-only";
import Stripe from "stripe";
import { verifyStripeAccount } from "../gala/backend/payment-mode";
import { patronCheckoutOpen, patronPaymentConfig, patronPaymentsEnabled } from "./payment-config";
import { patronPaymentHandlers } from "./payment-http";
import { getPatronPaymentStore } from "./payment-store";
export async function patronPaymentBackend() {
  const config = patronPaymentConfig();
  const stripe = new Stripe(config.key, { timeout: 20_000, maxNetworkRetries: 1 });
  verifyStripeAccount((await stripe.accounts.retrieveCurrent()).id, config.paymentMode);
  return { store: await getPatronPaymentStore(), stripe, config };
}
export const patronPaymentRoutes = patronPaymentHandlers({ enabled: patronPaymentsEnabled, open: patronCheckoutOpen,
  config: patronPaymentConfig, backend: patronPaymentBackend });
