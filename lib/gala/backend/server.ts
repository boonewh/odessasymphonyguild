import "server-only";
import { timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { readBackendConfig, DEVELOPMENT_STRIPE_ACCOUNT } from "./config";
import { SupabaseOrderStore } from "./store";

export function authorizeDevelopment(request: Request, token: string) {
  const provided = request.headers.get("x-gala-development-token") || "";
  if (provided.length !== token.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(token)))
    throw new Error("Development authentication required.");
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
