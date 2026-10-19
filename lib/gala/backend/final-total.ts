import { createHash } from "node:crypto";
import { ledgerReport } from "./ledger";
import { ledgerDate, type LedgerLine, type LedgerReport } from "../ledger";
import type { AccountingMapping, Receipt, AccountingJob } from "./accounting";
import { backendEnabled } from "./config";

export type FinalBatch = AccountingJob & {
  id: string; revision: string; source: unknown; lines: LedgerLine[]; amount: number;
  mapping: AccountingMapping; payload: Receipt; realm_id: string; created_at: string; synced_at: string | null;
};
export function finalSenderAvailable(env: NodeJS.ProcessEnv) {
  return backendEnabled(env) && env.NODE_ENV === "development" && !env.VERCEL && !env.VERCEL_ENV;
}
export function finalBlockers(report: LedgerReport) {
  return [
    ...(report.history.length ? ["Earlier QuickBooks entries or accounting attempts need review before this total can be sent."] : []),
    ...(report.pendingOrderCount ? ["Wait for every unpaid checkout to be paid or confirmed expired before closing sales."] : []),
    ...(!report.paidOrderCount ? ["There are no paid sales to send."] : []),
  ];
}
export function finalReceipt(id: string, revision: string, amount: number, mapping: AccountingMapping, now = new Date()) : Receipt {
  if (!/^[a-f0-9-]{36}$/.test(id) || !/^[a-f0-9]{64}$/.test(revision)
    || !Number.isSafeInteger(amount) || amount <= 0 || Object.values(mapping).some(v => !/^\d+$/.test(v)))
    throw new Error("Verified final total and sandbox mapping required.");
  return { DocNumber: `G27-${createHash("sha256").update(`final:${id}`).digest("hex").slice(0, 17)}`,
    TxnDate: ledgerDate(now.toISOString()), CurrencyRef: { value: "USD" }, CustomerRef: { value: mapping.customerId },
    DepositToAccountRef: { value: mapping.clearingAccountId },
    PrivateNote: `OSG Gala 2027 final total; batch ${id}; revision ${revision}; sandbox`,
    Line: [{ Amount: amount / 100, Description: "Symphony Ball Revenue — final Gala sales total", DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: { ItemRef: { value: mapping.itemId }, Qty: 1, UnitPrice: amount / 100, TaxCodeRef: { value: "NON" } } }] };
}
export function prepareFinal(source: unknown, revision: string, id: string, mapping: AccountingMapping, now = new Date()) {
  const report = ledgerReport(source);
  if (report.preview.revision !== revision) throw new Error("The total changed. Refresh and review it again.");
  const reasons = finalBlockers(report);
  if (reasons.length) throw new Error(reasons.join(" "));
  return { source, revision, id, lines: report.lines.filter(l => l.status === "paid"), mapping,
    payload: finalReceipt(id, revision, report.paidAmount, mapping, now) };
}
export function batchSummary(batch: FinalBatch | null) {
  return batch && { id: batch.id, revision: batch.revision, amount: batch.amount, status: batch.status,
    orderCount: new Set(batch.lines.map(l => l.orderId)).size, createdAt: batch.created_at, sentAt: batch.synced_at,
    receiptId: batch.receipt_id, companyId: batch.realm_id, dispatched: !!batch.dispatched_at };
}
