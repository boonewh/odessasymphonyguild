import { z } from "zod";
import { checkoutRequest } from "./checkout-request";
import { csvDocument } from "./csv";
import { paymentEnvironment, type PaymentMode } from "./backend/payment-mode";

// Historical October 2026 prices, deliberately independent of the live catalogue.
// A price change needs a versioned source of line prices, never a rewrite of these.
export const LEDGER_PRODUCTS = {
  platinum: { label: "Platinum table", unit: 550000 },
  "platinum-extra": { label: "Platinum extra seat", unit: 68750 },
  gold: { label: "Gold table", unit: 350000 },
  "gold-extra": { label: "Gold extra seat", unit: 43750 },
  silver: { label: "Silver table", unit: 200000 },
  "silver-extra": { label: "Silver extra seat", unit: 25000 },
  couples: { label: "Couples ticket", unit: 30000 },
  "student-date": { label: "Student date ticket", unit: 10000 },
  rose: { label: "Rose", unit: 1000 },
  cookies: { label: "Cookie bag", unit: 1000 },
} as const;
export type LedgerProduct = keyof typeof LEDGER_PRODUCTS;
const statusSchema = z.enum(["reserved", "awaiting_payment", "paid", "expired"]);
const dateSchema = z.string().refine(s => Number.isFinite(Date.parse(s)));
export const ledgerSnapshotSchema = z.object({
  orders: z.array(z.object({
    id: z.uuid(), details: checkoutRequest, amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    currency: z.literal("usd"), status: statusSchema, created_at: dateSchema,
    confirmed_at: dateSchema.nullable(), stripe_session_id: z.string().nullable(), payment_intent_id: z.string().nullable(),
  })),
  accounting: z.array(z.object({
    order_id: z.uuid(), status: z.enum(["pending", "processing", "synced", "review"]),
    dispatched_at: dateSchema.nullable(), receipt_id: z.string().nullable(), realm_id: z.string().nullable(),
  })),
});
export type LedgerSnapshot = z.infer<typeof ledgerSnapshotSchema>;
export type LedgerLine = {
  id: string; orderId: string; createdAt: string; orderDate: string; confirmedAt: string | null;
  buyer: string; email: string; product: LedgerProduct; quantity: number; unitAmount: number; amount: number;
  student: string; grade: string; status: z.infer<typeof statusSchema>;
  paymentId: string | null; sessionId: string | null;
};
export type LedgerHistory = { orderId: string; status: string; receiptId: string | null; companyId: string | null; amount: number };
export type Ledger = {
  lines: LedgerLine[]; paidOrderCount: number; paidAmount: number; pendingOrderCount: number; pendingAmount: number;
  expiredOrderCount: number; expiredAmount: number; history: LedgerHistory[];
};
export type LedgerReport = Ledger & {
  checkedAt: string;
  preview: { revision: string; account: "Symphony Ball Revenue"; amount: number; orderIds: string[]; canSend: false; reasons: string[] };
};
export function ledgerDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
export function ledgerStatus(status: LedgerLine["status"]) {
  return status === "paid" ? "Paid" : status === "expired" ? "Closed without payment" : "Awaiting payment";
}
function addMoney(a: number, b: number) {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new Error("Ledger total exceeds safe precision.");
  return sum;
}
export function buildLedger(raw: unknown, mode: PaymentMode = "sandbox"): Ledger {
  const sessionPrefix = paymentEnvironment(mode).sessionPrefix;
  const snapshot = ledgerSnapshotSchema.parse(raw);
  const orders = new Map(snapshot.orders.map(o => [o.id, o]));
  if (orders.size !== snapshot.orders.length || new Set(snapshot.accounting.map(a => a.order_id)).size !== snapshot.accounting.length)
    throw new Error("Duplicate ledger source records.");
  const result: Ledger = { lines: [], paidOrderCount: 0, paidAmount: 0, pendingOrderCount: 0, pendingAmount: 0, expiredOrderCount: 0, expiredAmount: 0, history: [] };
  const payments = new Set<string>(), sessions = new Set<string>();
  for (const order of snapshot.orders) {
    if (order.details.requestId !== order.id) throw new Error("Order reference mismatch.");
    if (order.status === "paid" && (!order.payment_intent_id?.startsWith("pi_") || !order.stripe_session_id?.startsWith(sessionPrefix) || !order.confirmed_at))
      throw new Error("Paid order lacks payment evidence.");
    for (const [value, seen] of [[order.payment_intent_id, payments], [order.stripe_session_id, sessions]] as const) {
      if (value && seen.has(value)) throw new Error("Duplicate payment reference.");
      if (value) seen.add(value);
    }
    const lines: LedgerLine[] = [];
    function add(product: LedgerProduct, quantity: number, source: string, student = "", grade = "") {
      if (!quantity) return;
      const unitAmount = LEDGER_PRODUCTS[product].unit;
      lines.push({ id: `${order.id}/${source}/${product}`, orderId: order.id, createdAt: order.created_at,
        orderDate: ledgerDate(order.created_at), confirmedAt: order.confirmed_at,
        buyer: order.details.contact.name, email: order.details.contact.email, product, quantity, unitAmount,
        amount: unitAmount * quantity, student, grade, status: order.status,
        paymentId: order.payment_intent_id, sessionId: order.stripe_session_id });
    }
    const details = order.details;
    const purchases = details.kind === "cart" ? details.purchases : details.kind === "tables" ? [details.purchase] : [];
    const gifts = details.kind === "tables" ? [] : details.gifts;
    purchases.forEach((p, index) => {
      add(p.product, p.quantity, `purchase-${index}`);
      if (p.extraSeats && (p.product === "platinum" || p.product === "gold" || p.product === "silver"))
        add(`${p.product}-extra`, p.extraSeats, `purchase-${index}`);
    });
    gifts.forEach((g, index) => {
      add("rose", g.roses, `gift-${index}`, g.student, g.grade);
      add("cookies", g.cookies, `gift-${index}`, g.student, g.grade);
    });
    if (lines.reduce((sum, line) => addMoney(sum, line.amount), 0) !== order.amount)
      throw new Error("Item prices do not reconcile to the saved order. Ledger review required.");
    result.lines.push(...lines);
    if (order.status === "paid") { result.paidOrderCount++; result.paidAmount = addMoney(result.paidAmount, order.amount); }
    else if (order.status === "expired") { result.expiredOrderCount++; result.expiredAmount = addMoney(result.expiredAmount, order.amount); }
    else { result.pendingOrderCount++; result.pendingAmount = addMoney(result.pendingAmount, order.amount); }
  }
  for (const job of snapshot.accounting) {
    const order = orders.get(job.order_id);
    if (!order || order.status !== "paid") throw new Error("Accounting source mismatch.");
    // A dispatched/uncertain entry is protected just as strictly as a known receipt.
    if (job.status !== "pending" || job.dispatched_at || job.receipt_id || job.realm_id)
      result.history.push({ orderId: order.id, status: job.status, receiptId: job.receipt_id, companyId: job.realm_id, amount: order.amount });
  }
  // Manual bookkeeping does not require an accounting job for each paid order.
  result.lines.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  result.history.sort((a, b) => a.orderId.localeCompare(b.orderId));
  return result;
}
export const ledgerFilterSchema = z.object({
  status: z.enum(["paid", "pending", "expired", "all"]).default("paid"),
  product: z.enum(["all", ...Object.keys(LEDGER_PRODUCTS) as LedgerProduct[]]).default("all"),
  query: z.string().trim().max(120).default(""),
  from: z.union([z.literal(""), z.iso.date()]).default(""),
  to: z.union([z.literal(""), z.iso.date()]).default(""),
}).refine(f => !f.from || !f.to || f.from <= f.to, { message: "Start date must come before the end date." });
export type LedgerFilter = z.infer<typeof ledgerFilterSchema>;
export function filterLedger(lines: LedgerLine[], filter: LedgerFilter) {
  const f = ledgerFilterSchema.parse(filter), query = f.query.toLowerCase();
  return lines.filter(l => (f.status === "all" || (f.status === "pending" ? ["reserved", "awaiting_payment"].includes(l.status) : l.status === f.status))
    && (f.product === "all" || l.product === f.product) && (!f.from || l.orderDate >= f.from) && (!f.to || l.orderDate <= f.to)
    && (!query || `${l.buyer} ${l.email} ${l.student} ${l.orderId} ${l.paymentId || ""}`.toLowerCase().includes(query)));
}
export function ledgerProductTotals(lines: LedgerLine[]) {
  return Object.entries(LEDGER_PRODUCTS).map(([product, item]) => {
    const paid = lines.filter(l => l.status === "paid" && l.product === product);
    return { product: product as LedgerProduct, label: item.label, quantity: paid.reduce((sum, l) => sum + l.quantity, 0),
      amount: paid.reduce((sum, l) => addMoney(sum, l.amount), 0) };
  }).filter(item => item.quantity > 0);
}
export function ledgerCsv(lines: LedgerLine[]) {
  return csvDocument([["Line reference", "Order reference", "Order date (America/Chicago)", "Created at (UTC)", "Payment confirmed in system (UTC)",
    "Buyer", "Email", "Item", "Student", "Grade", "Quantity", "Unit price (USD)", "Line total (USD)", "Payment status", "Stripe payment", "Stripe checkout"],
    ...lines.map(l => [l.id, l.orderId, l.orderDate, l.createdAt, l.confirmedAt, l.buyer, l.email, LEDGER_PRODUCTS[l.product].label,
      l.student, l.grade, l.quantity, (l.unitAmount / 100).toFixed(2), (l.amount / 100).toFixed(2), ledgerStatus(l.status), l.paymentId, l.sessionId])]);
}
export function ledgerSummaryCsv(lines: LedgerLine[]) {
  const items = ledgerProductTotals(lines);
  return csvDocument([["Paid item", "Quantity", "Sales total (USD)"], ...items.map(i => [i.label, i.quantity, (i.amount / 100).toFixed(2)]),
    ["Total paid sales", "", (items.reduce((sum, i) => addMoney(sum, i.amount), 0) / 100).toFixed(2)]]);
}
