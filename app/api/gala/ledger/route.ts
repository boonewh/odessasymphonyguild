import { authorizeStaff } from "@/lib/gala/backend/request-access";
import { backendEnabled, readBackendConfig } from "@/lib/gala/backend/config";
import { SupabaseOrderStore } from "@/lib/gala/backend/store";
import { ledgerReport } from "@/lib/gala/backend/ledger";
import { filterLedger, ledgerFilterSchema, ledgerCsv, ledgerSummaryCsv } from "@/lib/gala/ledger";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request) {
  if (!backendEnabled(process.env)) return new Response(null, { status: 404, headers });
  try { await authorizeStaff(request, true); }
  catch { return new Response(null, { status: 401, headers }); }
  const query = new URL(request.url).searchParams;
  const format = query.get("format") || "json";
  const filter = ledgerFilterSchema.safeParse(Object.fromEntries(["status", "product", "query", "from", "to"].filter(k => query.has(k)).map(k => [k, query.get(k)])));
  if (!filter.success || !["json", "csv", "summary", "preview"].includes(format))
    return Response.json({ error: "Check the ledger filters and date range." }, { status: 400, headers });
  try {
    const config = readBackendConfig(process.env), store = new SupabaseOrderStore(config.url, config.dbKey);
    await store.verifyEnvironment();
    const report = ledgerReport(await store.ledgerSnapshot());
    if (format === "json") return Response.json(report, { headers });
    if (format === "preview") return Response.json({ testOnly: true, notice: "Review copy only. This does not send or reserve an accounting entry.",
      checkedAt: report.checkedAt, ...report.preview, accountingHistory: report.history, lines: report.lines.filter(l => l.status === "paid") },
      { headers: { ...headers, "Content-Disposition": 'attachment; filename="gala-final-total-preview.json"' } });
    const lines = filterLedger(report.lines, filter.data);
    return new Response(format === "csv" ? ledgerCsv(lines) : ledgerSummaryCsv(lines), { headers: { ...headers,
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="gala-${format === "csv" ? "item-ledger" : "paid-item-totals"}.csv"` } });
  } catch {
    return Response.json({ error: "The complete ledger could not be verified. Refresh to try again; no totals or downloads are available until it checks out." }, { status: 503, headers });
  }
}
