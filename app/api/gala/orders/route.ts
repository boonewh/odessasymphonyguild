import { authorizeStaff } from "@/lib/gala/backend/request-access";
import { backendEnabled } from "@/lib/gala/backend/config";
import { backend } from "@/lib/gala/backend/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try { await authorizeStaff(request); }
  catch { return new Response(null, { status: 401 }); }
  try {
    const { store } = await backend();
    return Response.json(await store.dashboard(), { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Could not load development orders." }, { status: 503 }); }
}
