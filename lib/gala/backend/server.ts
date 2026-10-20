import "server-only";
import Stripe from "stripe";
import { readBackendConfig } from "./config";
import { verifyStripeAccount } from "./payment-mode";
import { SupabaseOrderStore } from "./store";
import { authorizeLocalRequest } from "./auth";

export function authorizeDevelopment(request: Request, token: string) {
  authorizeLocalRequest(request, token, process.env.GALA_LOCAL_ORIGIN || "http://localhost:3000");
}
export async function backend() {
  const config = readBackendConfig(process.env);
  const stripe = new Stripe(config.key, { maxNetworkRetries: 2, timeout: 20_000 });
  const account = await stripe.accounts.retrieveCurrent();
  verifyStripeAccount(account.id, config.paymentMode);
  const store = new SupabaseOrderStore(config.url, config.dbKey);
  await store.verifyEnvironment();
  return { config, stripe, store };
}
