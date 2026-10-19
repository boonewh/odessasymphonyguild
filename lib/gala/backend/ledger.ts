import { createHash } from "node:crypto";
import { buildLedger, type LedgerReport } from "../ledger";

export function ledgerReport(snapshot: unknown, checkedAt = new Date().toISOString()): LedgerReport {
  const ledger = buildLedger(snapshot);
  const paid = ledger.lines.filter(l => l.status === "paid");
  // Content identity excludes read time and unpaid drafts. Never accept this
  // client-held reference as posting authority; a future sender must revalidate.
  const revision = createHash("sha256").update(JSON.stringify({ version: 1, paid, history: ledger.history })).digest("hex");
  return { ...ledger, checkedAt, preview: {
    revision, account: "Symphony Ball Revenue", amount: ledger.paidAmount,
    orderIds: [...new Set(paid.map(l => l.orderId))].sort(), canSend: false,
    reasons: ["For manual bookkeeping. Nothing is sent to QuickBooks.",
      ...(ledger.history.length ? ["Historical accounting entries are retained for reference. Check for previously recorded sales before making a manual entry."] : []),
      ...(ledger.pendingOrderCount ? ["Some orders still await payment. Their amounts are excluded; the final total may change."] : []),
      ...(!paid.length ? ["There are no paid sales to include."] : [])],
  } };
}
