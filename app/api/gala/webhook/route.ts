import Stripe from "stripe";
import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { backend } from "@/lib/gala/backend/server";
import { reconcileSession } from "@/lib/gala/backend/checkout";
import { parseWebhook } from "@/lib/gala/backend/webhook";
export const runtime = "nodejs";
const relevant = new Set(["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"]);
export async function POST(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  let event: Stripe.Event;
  try {
    const config = readBackendConfig(process.env);
    const stripe = new Stripe(config.key);
    const body = await request.text();
    if (body.length > 262144) return new Response(null, { status: 413 });
    event = parseWebhook(stripe, body, request.headers.get("stripe-signature") || "", config.webhookSecret);
  } catch { return Response.json({ error: "Invalid webhook." }, { status: 400 }); }
  if (!relevant.has(event.type)) return Response.json({ received: true });
  try {
    const { store, stripe } = await backend();
    await reconcileSession(store, stripe, (event.data.object as Stripe.Checkout.Session).id, event.id);
    return Response.json({ received: true });
  } catch { return Response.json({ error: "Payment update requires retry." }, { status: 500 }); }
}
