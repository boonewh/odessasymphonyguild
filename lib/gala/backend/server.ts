import "server-only";
import Stripe from "stripe";
import { readBackendConfig, DEVELOPMENT_STRIPE_ACCOUNT } from "./config";
import { SupabaseOrderStore } from "./store";
import { authorizeLocalRequest } from "./auth";

export function authorizeDevelopment(request: Request, token: string) {
  authorizeLocalRequest(request, token, process.env.GALA_LOCAL_ORIGIN || "http://localhost:3000");
}
export async function backend() {
  const config = readBackendConfig(process.env);
  const stripe = new Stripe(config.key, { maxNetworkRetries: 2, timeout: 20_000 });
  const account = await stripe.accounts.retrieveCurrent();
  if (account.id !== DEVELOPMENT_STRIPE_ACCOUNT) throw new Error("Unexpected Stripe sandbox account.");
  const store = new SupabaseOrderStore(config.url, config.dbKey);
  await store.verifyEnvironment();
  return { config, stripe, store };
}
