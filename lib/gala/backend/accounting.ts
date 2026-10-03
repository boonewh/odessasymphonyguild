import { createHash } from "node:crypto";
import type { Order } from "./domain";

export type AccountingMapping = { realmId: string; customerId: string; itemId: string; incomeAccountId: string; clearingAccountId: string };
export type Receipt = {
  DocNumber: string; TxnDate: string; CurrencyRef: { value: "USD" };
  CustomerRef: { value: string }; DepositToAccountRef: { value: string };
  PrivateNote: string; Line: { Amount: number; Description: string; DetailType: "SalesItemLineDetail";
    SalesItemLineDetail: { ItemRef: { value: string }; Qty: number; UnitPrice: number; TaxCodeRef: { value: "NON" } } }[];
};
export type AccountingJob = {
  order_id: string; status: string; realm_id: string | null; payload: Receipt | null;
  dispatched_at: string | null; receipt_id: string | null;
};
export interface AccountingStore {
  claim(id: string, owner: string): Promise<AccountingJob | null>;
  prepare(id: string, owner: string, realm: string, payload: Receipt): Promise<AccountingJob>;
  dispatch(id: string, owner: string): Promise<void>;
  finish(id: string, owner: string, receiptId: string): Promise<void>;
  review(id: string, owner: string, code: string): Promise<void>;
}
export interface ReceiptGateway {
  realmId: string;
  find(docNumber: string): Promise<unknown[]>;
  create(payload: Receipt, requestId: string): Promise<unknown>;
}

export function receiptFor(order: Order, mapping: AccountingMapping, paidAt: number): Receipt {
  if (order.status !== "paid" || !order.payment_intent_id || !order.stripe_session_id
    || order.currency !== "usd" || !Number.isSafeInteger(order.amount) || order.amount <= 0)
    throw new Error("Only verified paid USD orders can be posted.");
  if (!Number.isFinite(paidAt) || paidAt <= 0) throw new Error("Verified payment date required.");
  for (const id of Object.values(mapping)) if (!/^\d+$/.test(id)) throw new Error("Explicit sandbox mapping required.");
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(paidAt * 1000));
  const part = (name: string) => date.find(p => p.type === name)!.value;
  const amount = order.amount / 100;
  return {
    DocNumber: `G27-${createHash("sha256").update(order.id).digest("hex").slice(0, 17)}`,
    TxnDate: `${part("year")}-${part("month")}-${part("day")}`,
    CurrencyRef: { value: "USD" }, CustomerRef: { value: mapping.customerId },
    DepositToAccountRef: { value: mapping.clearingAccountId },
    PrivateNote: `OSG Gala order ${order.id}; Stripe ${order.payment_intent_id}; sandbox`,
    // NON is a sandbox test assumption only, not a determination of OSG's tax obligations.
    Line: [{ Amount: amount, Description: "Symphony Ball", DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: { ItemRef: { value: mapping.itemId }, Qty: 1, UnitPrice: amount, TaxCodeRef: { value: "NON" } } }],
  };
}

export function verifyReceipt(raw: unknown, expected: Receipt): string {
  const r = raw as Record<string, any> | null;
  const lines = r?.Line?.filter((l: any) => l.DetailType === "SalesItemLineDetail");
  const moneyEquals = (a: unknown, b: number) => typeof a === "number" && Math.abs(a * 100 - Math.round(b * 100)) < 0.001;
  if (!r || !/^\d+$/.test(r.Id) || r.DocNumber !== expected.DocNumber || r.TxnDate !== expected.TxnDate
    || r.PrivateNote !== expected.PrivateNote || r.CurrencyRef?.value !== "USD"
    || r.CustomerRef?.value !== expected.CustomerRef.value || r.DepositToAccountRef?.value !== expected.DepositToAccountRef.value
    || !moneyEquals(r.TotalAmt, expected.Line[0].Amount) || lines?.length !== 1
    || !moneyEquals(lines[0].Amount, expected.Line[0].Amount)
    || lines[0].SalesItemLineDetail?.ItemRef?.value !== expected.Line[0].SalesItemLineDetail.ItemRef.value
    || (r.TxnTaxDetail?.TotalTax ?? 0) !== 0)
    throw new Error("Receipt mismatch; accounting review required.");
  return r.Id;
}

// A dispatched job is lookup-only on every retry. Even an ambiguous POST failure
// cannot cause another sale. Recovering a missing receipt requires operator review.
export async function syncReceipt(store: AccountingStore, gateway: ReceiptGateway, id: string, owner: string,
  prepare: () => Promise<Receipt>) {
  const job = await store.claim(id, owner);
  if (!job) return "busy_or_synced";
  try {
    const saved = job.payload ? job : await store.prepare(id, owner, gateway.realmId, await prepare());
    if (saved.realm_id !== gateway.realmId || !saved.payload) throw new Error("Company mismatch.");
    const matches = await gateway.find(saved.payload.DocNumber);
    if (matches.length > 1) throw new Error("Multiple matching receipts.");
    let raw: unknown;
    if (matches.length === 1) raw = matches[0];
    else {
      if (saved.dispatched_at) throw new Error("Previously dispatched receipt not found.");
      await store.dispatch(id, owner); // durable before any external write
      raw = await gateway.create(saved.payload, id);
    }
    const receiptId = verifyReceipt(raw, saved.payload);
    await store.finish(id, owner, receiptId);
    return "synced";
  } catch {
    await store.review(id, owner, "verification_required").catch(() => {});
    return "review";
  }
}
