import { authorizeStaff } from "@/lib/gala/backend/request-access";
import { backendEnabled } from "@/lib/gala/backend/config";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try { await authorizeStaff(request, true); }
  catch { return new Response(null, { status: 403 }); }
  // Old tabs and accidentally enabled flags must not restart per-order sending.
  return Response.json({ error: "Individual-order sending is retired. Use the ledger's final-total preview. Sending the final total is not enabled." },
    { status: 409, headers: { "Cache-Control": "no-store" } });
}
