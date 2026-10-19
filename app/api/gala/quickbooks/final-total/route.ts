import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorizeStaff } from "@/lib/gala/backend/request-access";
import { readBackendConfig } from "@/lib/gala/backend/config";
import { SupabaseOrderStore } from "@/lib/gala/backend/store";
import { AccountingDatabase } from "@/lib/gala/backend/accounting-store";
import { FinalTotalDatabase } from "@/lib/gala/backend/final-total-store";
import { finalSenderAvailable, finalBlockers, prepareFinal, batchSummary } from "@/lib/gala/backend/final-total";
import { ledgerReport } from "@/lib/gala/backend/ledger";
import { readQbConfig, readFinalQbMapping } from "@/lib/gala/backend/qb-config";
import { qbAccessToken, SandboxQuickBooks } from "@/lib/gala/backend/qb-client";
import { syncReceipt } from "@/lib/gala/backend/accounting";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const input = z.union([
  z.object({ revision: z.string().regex(/^[a-f0-9]{64}$/), closeSales: z.literal(true) }).strict(),
  z.object({ batchId: z.uuid() }).strict(),
]);
export async function GET(request: Request) {
  if (!finalSenderAvailable(process.env)) return new Response(null, { status: 404, headers });
  try { await authorizeStaff(request, true); } catch { return new Response(null, { status: 401, headers }); }
  try {
    const config = readBackendConfig(process.env), orders = new SupabaseOrderStore(config.url, config.dbKey);
    await orders.verifyEnvironment();
    const batch = await new FinalTotalDatabase(config.url, config.dbKey).current();
    if (new URL(request.url).searchParams.get("format") === "saved") {
      if (!batch) return new Response(null, { status: 404, headers });
      return Response.json({ testOnly: true, batch: batchSummary(batch), lines: batch.lines, source: batch.source, receipt: batch.payload },
        { headers: { ...headers, "Content-Disposition": 'attachment; filename="gala-saved-final-total.json"' } });
    }
    const report = ledgerReport(await orders.ledgerSnapshot());
    return Response.json({ batch: batchSummary(batch), amount: report.paidAmount, orderCount: report.paidOrderCount,
      revision: report.preview.revision, reasons: batch ? [] : finalBlockers(report), enabled: process.env.GALA_QB_FINAL_ENABLED === "true" }, { headers });
  } catch {
    return Response.json({ error: "Final sending setup is not ready. Check development migration 013 and refresh. The ledger remains available." }, { status: 503, headers });
  }
}
export async function POST(request: Request) {
  if (!finalSenderAvailable(process.env) || process.env.GALA_QB_FINAL_ENABLED !== "true") return new Response(null, { status: 404, headers });
  let actor: string | undefined;
  try { actor = await authorizeStaff(request, true); } catch { return new Response(null, { status: 401, headers }); }
  let body: z.infer<typeof input>;
  try { const text = await request.text(); if (text.length > 1024) throw new Error(); body = input.parse(JSON.parse(text)); }
  catch { return Response.json({ error: "Review the total and confirm that test sales should close." }, { status: 400, headers }); }
  try {
    const config = readQbConfig(process.env), mapping = readFinalQbMapping(process.env), owner = randomUUID();
    const connection = new AccountingDatabase(config.url, config.dbKey); await connection.verify();
    const totals = new FinalTotalDatabase(config.url, config.dbKey);
    await connection.lock(owner);
    try {
      const gateway = new SandboxQuickBooks(config.realmId, await qbAccessToken(config, connection, owner));
      await gateway.verifyMapping(mapping, true);
      let batch = await totals.current();
      if ("batchId" in body) {
        if (!batch || batch.id !== body.batchId) throw new Error("Saved total not found.");
      } else {
        if (batch) throw new Error("A final total already exists. Refresh to check its result.");
        const snapshot = await new SupabaseOrderStore(config.url, config.dbKey).ledgerSnapshot();
        batch = await totals.freeze(prepareFinal(snapshot, body.revision, randomUUID(), mapping), actor || "local-development");
      }
      if (Object.keys(mapping).some(k => mapping[k as keyof typeof mapping] !== batch.mapping[k as keyof typeof mapping]))
        throw new Error("Saved company or mapping changed.");
      const outcome = await syncReceipt(totals, gateway, batch.id, owner, async () => { throw new Error("Frozen payload required."); });
      return Response.json({ outcome, batch: batchSummary(await totals.current()) }, { headers });
    } finally { await connection.unlock(owner); }
  } catch {
    return Response.json({ error: "Sending could not be confirmed. Refresh the saved total before trying again. Check the sandbox connection, account mapping, and any earlier accounting entries." }, { status: 409, headers });
  }
}
