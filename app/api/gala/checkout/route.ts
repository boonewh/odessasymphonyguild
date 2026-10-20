import { backendEnabled } from "@/lib/gala/backend/config";
import { backend } from "@/lib/gala/backend/server";
import { authorizeCustomer } from "@/lib/gala/backend/request-access";
import { startCheckout } from "@/lib/gala/backend/checkout";
import { CartUnavailable, GalaSalesClosed } from "@/lib/gala/backend/domain";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  let customerHash: string | undefined;
  try { customerHash = authorizeCustomer(request); }
  catch { return Response.json({ error: "Local development setup or authorization required." }, { status: 403 }); }
  try {
    const body = await request.text();
    if (body.length > 32000) return new Response(null, { status: 413 });
    const { store, stripe, config } = await backend();
    store.customerHash = customerHash;
    const result = await startCheckout(store, stripe, JSON.parse(body), config.origin, Date.now(), config.paymentMode);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GalaSalesClosed) return Response.json({ code: "SALES_CLOSED", error: "Gala sales have closed. No new payment was started." }, { status: 409 });
    if (error instanceof CartUnavailable) return Response.json({ code: "CART_UNAVAILABLE", error: "There are not enough tables available for this selection. No payment was started. Change your cart and try again." }, { status: 409 });
    return Response.json({ error: "Checkout could not be confirmed. Use Resume the same checkout below; please do not start a replacement purchase." }, { status: 409 });
  }
}
