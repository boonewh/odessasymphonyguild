"use client";
import { useCallback, useEffect, useState } from "react";
import { LEDGER_PRODUCTS, filterLedger, ledgerFilterSchema, ledgerProductTotals, ledgerStatus, type LedgerFilter, type LedgerReport } from "@/lib/gala/ledger";
import { money } from "@/lib/gala/model";
import styles from "./PaymentLab.module.css";
import ledgerStyles from "./GalaLedger.module.css";
import GalaFinalTotal from "./GalaFinalTotal";

const defaults = ledgerFilterSchema.parse({});
const pageSize = 25;
export default function GalaLedger({ active = true }: { active?: boolean }) {
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [filter, setFilter] = useState<LedgerFilter>(defaults);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/gala/ledger", { cache: "no-store", signal });
      if (response.status === 401) throw new Error("Sign in again with accounting access to view the ledger.");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load the ledger.");
      if (!signal?.aborted) setReport(result);
    } catch (e) {
      if (!signal?.aborted) { setReport(null); setError((e as Error).message); }
    } finally { if (!signal?.aborted) setBusy(false); }
  }, []);
  // Read on entering this tab; hidden panels keep their filters, not a polling loop.
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [active, load]);
  function change(patch: Partial<LedgerFilter>) { setFilter(f => ({ ...f, ...patch })); setPage(0); }
  const valid = ledgerFilterSchema.safeParse(filter);
  const lines = report && valid.success ? filterLedger(report.lines, valid.data) : [];
  const items = ledgerProductTotals(lines);
  const paidSubtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const lastPage = Math.max(0, Math.ceil(lines.length / pageSize) - 1), currentPage = Math.min(page, lastPage);
  async function download(format: "csv" | "summary" | "preview") {
    setBusy(true); setError("");
    try {
      const query = new URLSearchParams(format === "preview" ? { format } : { ...filter, format });
      const response = await fetch(`/api/gala/ledger?${query}`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 401) throw new Error("Sign in again with accounting access to download the ledger.");
        const result = await response.json(); throw new Error(result.error || "Download failed. Try again.");
      }
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
      link.href = url; link.download = format === "preview" ? "gala-final-total-preview.json" : format === "csv" ? "gala-item-ledger.csv" : "gala-paid-item-totals.csv";
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setReport(null); setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className={ledgerStyles.ledger} aria-labelledby="ledger-title" aria-busy={busy}>
    <div className={ledgerStyles.heading}>
      <div><h2 id="ledger-title">Sales ledger</h2><p>Every purchase stays here, item by item. QuickBooks will receive one combined sales total at the end.</p></div>
      <button type="button" className={ledgerStyles.secondary} disabled={busy} onClick={() => void load()}>{busy ? "Checking ledger…" : "Refresh ledger"}</button>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!report && !error && <p role="status">Loading the complete ledger…</p>}
    {report && <>
      <div className={ledgerStyles.metricsContainer}><dl className={ledgerStyles.metrics}>
        <div><dt>Paid sales</dt><dd>{money(report.paidAmount)}</dd><dd>{report.paidOrderCount} paid orders</dd></div>
        <div><dt>Awaiting payment</dt><dd>{money(report.pendingAmount)}</dd><dd>{report.pendingOrderCount} orders · excluded from sales</dd></div>
        <div><dt>Closed without payment</dt><dd>{report.expiredOrderCount} orders</dd><dd>{money(report.expiredAmount)} · excluded from sales</dd></div>
      </dl></div>
      <p className={styles.note}>All saved orders included. Checked {new Date(report.checkedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} Central. Refresh for newer payments. Amounts show sales before processing fees.</p>
      <div className={ledgerStyles.filters}>
        <label>Payment status<select name="ledger-status" value={filter.status} onChange={e => change({ status: e.target.value as LedgerFilter["status"] })}>
          <option value="paid">Paid purchases</option><option value="pending">Awaiting payment</option><option value="expired">Closed without payment</option><option value="all">All purchases</option>
        </select></label>
        <label>Item<select name="ledger-product" value={filter.product} onChange={e => change({ product: e.target.value as LedgerFilter["product"] })}>
          <option value="all">All items</option>{Object.entries(LEDGER_PRODUCTS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
        </select></label>
        <label className={ledgerStyles.search}>Find a purchase<input type="search" name="ledger-query" value={filter.query} maxLength={120} placeholder="Buyer, student, email or order reference" onChange={e => change({ query: e.target.value })}/></label>
        <label>Order date from<input type="date" name="ledger-from" value={filter.from} onChange={e => change({ from: e.target.value })}/></label>
        <label>Order date through<input type="date" name="ledger-to" value={filter.to} onChange={e => change({ to: e.target.value })}/></label>
        <button type="button" className={ledgerStyles.secondary} onClick={() => { setFilter(defaults); setPage(0); }}>Reset filters</button>
      </div>
      {!valid.success && <p role="alert" className={styles.error}>Check the date range. The start date must be on or before the end date.</p>}
      <div className={styles.tools}>
        <button type="button" disabled={busy || !valid.success} onClick={() => void download("csv")}>Download item ledger (CSV)</button>
        <button type="button" className={ledgerStyles.secondary} disabled={busy || !valid.success} onClick={() => void download("summary")}>Download paid item totals (CSV)</button>
      </div>
      <p className={styles.note}>Downloads use these filters and include every matching row, across all pages. Dates use Central time. CSV files open in Excel. Downloaded figures are checked again for newer payments.</p>
      <p role="status"><strong>{lines.length} matching item rows</strong> · Paid sales in this view: <strong>{money(paidSubtotal)}</strong></p>
      {items.length > 0 && <details className={ledgerStyles.totals}><summary>Paid totals by item for this view</summary>
        <dl>{items.map(item => <div key={item.product}><dt>{item.label} · {item.quantity}</dt><dd>{money(item.amount)}</dd></div>)}</dl>
      </details>}
      {lines.length === 0 ? <p>No purchases match these filters.</p> : <>
        <div className={ledgerStyles.tableScroll} tabIndex={0} role="region" aria-label="Item ledger, scroll horizontally for all columns"><div className={ledgerStyles.tableInner}>
          <table><caption className="sr-only">Itemized Gala purchases matching the selected filters</caption>
            <thead><tr><th scope="col">Order date</th><th scope="col">Buyer</th><th scope="col">Item</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Line total</th><th scope="col">Payment</th></tr></thead>
            <tbody>{lines.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(line => <tr key={line.id}>
              <td>{line.orderDate}<details><summary>References</summary><p>Order: {line.orderId}</p>{line.paymentId && <p>Payment: {line.paymentId}</p>}{line.confirmedAt && <p>Confirmed in system: {new Date(line.confirmedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} Central</p>}</details></td>
              <td>{line.buyer}<small>{line.email}</small></td>
              <td>{LEDGER_PRODUCTS[line.product].label}{line.student && <small>For {line.student} · Grade {line.grade}</small>}</td>
              <td className={ledgerStyles.number}>{line.quantity}</td><td className={ledgerStyles.number}>{money(line.unitAmount)}</td><td className={ledgerStyles.number}>{money(line.amount)}</td><td>{ledgerStatus(line.status)}</td>
            </tr>)}</tbody>
          </table>
        </div></div>
        <nav className={styles.tools} aria-label="Ledger pages"><button type="button" className={ledgerStyles.secondary} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span>Page {currentPage + 1} of {lastPage + 1}</span><button type="button" className={ledgerStyles.secondary} disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next</button></nav>
      </>}
      <section className={ledgerStyles.preview} aria-labelledby="final-total-title">
        <h3 id="final-total-title">Final QuickBooks total · preview</h3>
        <p className={ledgerStyles.finalAmount}>{money(report.preview.amount)}</p>
        <p>One total for <strong>{report.preview.account}</strong>, covering all {report.paidOrderCount} paid orders. Filters above do not change this total.</p>
        <p>Nothing is sent from this preview. Your detailed ledger will stay here after the final total is sent.</p>
        <ul role="list">{report.preview.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
        {report.history.length > 0 && <details><summary>Review {report.history.length} earlier accounting attempts</summary>
          <p>These sales remain in the ledger. A combined total must not record them again without resolving the earlier entries.</p>
          <ul role="list">{report.history.map(item => <li key={item.orderId}>Order {item.orderId} · {money(item.amount)} · {item.receiptId ? `QuickBooks receipt ${item.receiptId}` : "Accounting attempt needs review"}</li>)}</ul>
        </details>}
        <details><summary>Save a detailed review copy</summary><p>This file includes the paid item details, included order references and a reference identifying this version of the total. It is for review, not a QuickBooks import.</p>
          <button type="button" className={ledgerStyles.secondary} disabled={busy} onClick={() => void download("preview")}>Download review copy (JSON)</button></details>
      </section>
    </>}
    <GalaFinalTotal active={active}/>
  </section>;
}
