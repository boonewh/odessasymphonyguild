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
    reasons: ["Preview only. Final sending is not enabled.",
      ...(ledger.history.length ? ["Some sales have earlier QuickBooks entries or accounting history that needs review. Resolve that history before sending any combined total."] : []),
      ...(ledger.pendingOrderCount ? ["Some orders still await payment. Their amounts are excluded; the final total may change."] : []),
      ...(!paid.length ? ["There are no paid sales to include."] : [])],
  } };
}
