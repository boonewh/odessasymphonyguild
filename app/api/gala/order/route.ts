import { z } from "zod";
import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { backend } from "@/lib/gala/backend/server";
import { authorizeOrder } from "@/lib/gala/backend/request-access";
import { reconcileSession, verifySession } from "@/lib/gala/backend/checkout";
import type { Order } from "@/lib/gala/backend/domain";
import { SupabaseOrderStore } from "@/lib/gala/backend/store";
export const runtime = "nodejs";
const publicOrder = (order: Order) => ({ id: order.id, status: order.status, kind: order.details.kind, amount: order.amount, description: order.description });
async function handle(request: Request, mutate: boolean) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  let customerHash: string | undefined;
  try { customerHash = await authorizeOrder(request); }
  catch { return new Response(null, { status: 401 }); }
  try {
    const orderId = z.uuid().parse(new URL(request.url).searchParams.get("orderId"));
    const config = readBackendConfig(process.env);
    const store = new SupabaseOrderStore(config.url, config.dbKey); await store.verifyEnvironment();
    store.customerHash = customerHash;
    let order = await store.get(orderId);
    let url: string | null = null;
    if (mutate && order.stripe_session_id) {
      const { stripe } = await backend();
      await reconcileSession(store, stripe, order.stripe_session_id, `flyer-check-${order.id}`);
      order = await store.get(orderId);
      if (order.status === "awaiting_payment" || order.status === "reserved") {
        const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id!);
        verifySession(order, session);
        if (session.status === "open") url = session.url;
      }
    }
    return Response.json({ order: publicOrder(order), url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Order status could not be verified. Keep this order reference and retry; do not start a replacement purchase yet." }, { status: 409 });
  }
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
