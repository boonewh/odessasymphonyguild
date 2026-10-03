import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { authorizeDevelopment, backend } from "@/lib/gala/backend/server";
import { startCheckout } from "@/lib/gala/backend/checkout";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try { authorizeDevelopment(request, readBackendConfig(process.env).token); }
  catch { return Response.json({ error: "Local development setup or authorization required." }, { status: 403 }); }
  try {
    const body = await request.text();
    if (body.length > 32000) return new Response(null, { status: 413 });
    const { store, stripe, config } = await backend();
    const result = await startCheckout(store, stripe, JSON.parse(body), config.origin);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Checkout could not be opened. Retry with the same request ID; any uncertain reservation remains held." }, { status: 409 });
  }
}
