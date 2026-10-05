import { authorizeStaff } from "@/lib/gala/backend/request-access";
import { backendEnabled } from "@/lib/gala/backend/config";
import { backend } from "@/lib/gala/backend/server";
import { reconcilePending } from "@/lib/gala/backend/checkout";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try { await authorizeStaff(request); }
  catch { return new Response(null, { status: 403 }); }
  try {
    const { store, stripe } = await backend();
    return Response.json(await reconcilePending(store, stripe), { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Reconciliation unavailable." }, { status: 503 }); }
}
