import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { authorizeDevelopment } from "@/lib/gala/backend/server";
import { SupabaseOrderStore } from "@/lib/gala/backend/store";
import { assignmentRequest, assignmentsCsv, filterAssignments, type AssignmentFilter } from "@/lib/gala/assignments";
export const runtime = "nodejs";
async function handle(request: Request, write: boolean) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404 });
  try { authorizeDevelopment(request, readBackendConfig(process.env).token); }
  catch { return new Response(null, { status: 401 }); }
  const config = readBackendConfig(process.env);
  const store = new SupabaseOrderStore(config.url, config.dbKey);
  try {
    await store.verifyEnvironment();
    if (write) {
      const body = await request.text();
      if (body.length > 1024) return new Response(null, { status: 413 });
      const parsed = assignmentRequest.safeParse(JSON.parse(body));
      if (!parsed.success) return Response.json({ error: "Use a whole table number from 1 to 999, or clear the assignment." }, { status: 400 });
      await store.assignTable(parsed.data);
    }
    const rows = await store.assignments();
    const query = new URL(request.url).searchParams;
    if (!write && query.get("format") === "csv") {
      const filter = query.get("filter") || "all";
      if (!["all", "assigned", "unassigned"].includes(filter)) return new Response(null, { status: 400 });
      return new Response(assignmentsCsv(filterAssignments(rows, filter as AssignmentFilter)), { headers: {
        "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="gala-2027-development-table-assignments.csv"',
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      } });
    }
    return Response.json({ assignments: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: write
      ? "Assignment was not confirmed. The number may be taken or this order changed. Refresh before retrying; your current assignment is preserved if the change was rejected."
      : "Cannot load table assignments. Check the local connection and development migration 003." }, { status: write ? 409 : 503 });
  }
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
