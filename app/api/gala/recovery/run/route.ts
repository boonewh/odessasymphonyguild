import Stripe from "stripe";
import { boardReviewAllowed } from "@/lib/gala/board-review";
import { readBackendConfig, DEVELOPMENT_STRIPE_ACCOUNT } from "@/lib/gala/backend/config";
import { authorizeScheduledRecovery } from "@/lib/gala/backend/scheduled-recovery";
import { SupabaseOrderStore } from "@/lib/gala/backend/store";
import { SupabaseRecoveryStore } from "@/lib/gala/backend/recovery-store";
import { recoveryPass } from "@/lib/gala/backend/recovery";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  if (!boardReviewAllowed(process.env)) return new Response(null, { status: 404 });
  const headers = { "Cache-Control": "no-store" };
  if (!authorizeScheduledRecovery(request, process.env)) return new Response(null, { status: 401, headers });
  try {
    const config = readBackendConfig(process.env);
    const stripe = new Stripe(config.key, { maxNetworkRetries: 0, timeout: 10_000 });
    if ((await stripe.accounts.retrieveCurrent()).id !== DEVELOPMENT_STRIPE_ACCOUNT) throw new Error("Wrong test account.");
    const store = new SupabaseOrderStore(config.url, config.dbKey);
    await store.verifyEnvironment();
    const queue = new SupabaseRecoveryStore(config.url, config.dbKey);
    // Shared database leases make overlapping scheduler calls safe. A terminated
    // invocation leaves its lease/hold intact for the next scheduled pass.
    return Response.json(await recoveryPass(queue, store, stripe, 5, 90_000), { headers });
  } catch {
    return Response.json({ error: "Payment check failed; reservations remain protected." }, { status: 503, headers });
  }
}
