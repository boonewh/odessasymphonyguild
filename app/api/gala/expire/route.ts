import { z } from "zod";
import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { authorizeDevelopment, backend } from "@/lib/gala/backend/server";
import { reconcileSession, verifySession } from "@/lib/gala/backend/checkout";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try { authorizeDevelopment(request, readBackendConfig(process.env).token); }
  catch { return new Response(null, { status: 403 }); }
  try {
    const raw = await request.text();
    if (raw.length > 1024) return new Response(null, { status: 413 });
    const { orderId } = z.object({ orderId: z.uuid() }).parse(JSON.parse(raw));
    const { store, stripe } = await backend();
    const order = await store.get(orderId);
    if (!order.stripe_session_id) throw new Error("Checkout needs investigation.");
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
    verifySession(order, session);
    if (session.status === "open") await stripe.checkout.sessions.expire(session.id, {}, { idempotencyKey: `gala-expire-${orderId}` });
    const state = await reconcileSession(store, stripe, session.id, `manual-expire-${session.id}`);
    return Response.json({ state });
  } catch { return Response.json({ error: "Expiration not verified. The reservation remains protected; refresh and reconcile." }, { status: 409 }); }
}
