import Stripe from "stripe";
import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { backend } from "@/lib/gala/backend/server";
import { parseWebhook, relevantCheckoutEvent, reconcileCheckoutEvent } from "@/lib/gala/backend/webhook";
import { isPatronCheckout, reconcilePatronSession } from "@/lib/patron/payment";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  let event: Stripe.Event;
  try {
    const config = readBackendConfig(process.env);
    const stripe = new Stripe(config.key);
    const body = await request.text();
    if (body.length > 262144) return new Response(null, { status: 413 });
    event = parseWebhook(stripe, body, request.headers.get("stripe-signature") || "", config.webhookSecret, config.paymentMode);
  } catch { return Response.json({ error: "Invalid webhook." }, { status: 400 }); }
  if (!relevantCheckoutEvent(event)) return Response.json({ received: true });
  try {
    if (isPatronCheckout(event)) {
      const { patronPaymentBackend } = await import("@/lib/patron/payment-server");
      const { store, stripe, config } = await patronPaymentBackend();
      await reconcilePatronSession(store, stripe, (event.data.object as Stripe.Checkout.Session).id, config.paymentMode);
      return Response.json({ received: true });
    }
    const { store, stripe, config } = await backend();
    await reconcileCheckoutEvent(store, stripe, event, config.paymentMode);
    return Response.json({ received: true });
  } catch { return Response.json({ error: "Payment update requires retry." }, { status: 500 }); }
}
