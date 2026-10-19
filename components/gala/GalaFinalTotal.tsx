"use client";
import { useCallback, useEffect, useState } from "react";
import { money } from "@/lib/gala/model";
import styles from "./GalaLedger.module.css";
type State = { amount: number; orderCount: number; revision: string; enabled: boolean; reasons: string[];
  batch: null | { id: string; amount: number; orderCount: number; status: string; receiptId: string | null; dispatched: boolean } };
export default function GalaFinalTotal({ active }: { active: boolean }) {
  const [state, setState] = useState<State | null>(null), [error, setError] = useState("");
  const [hidden, setHidden] = useState(false), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true); setError(""); setConfirm(false);
    try {
      const r = await fetch("/api/gala/quickbooks/final-total", { cache: "no-store", signal });
      if (r.status === 404) { if (!signal?.aborted) setHidden(true); return; }
      if (r.status === 401) throw new Error("Sign in again with accounting access.");
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      if (!signal?.aborted) { setHidden(false); setState(data); }
    } catch (e) { if (!signal?.aborted) { setState(null); setError((e as Error).message); } }
    finally { if (!signal?.aborted) setBusy(false); }
  }, []);
  useEffect(() => { if (!active) return; const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [active, load]);
  async function send() {
    if (!state) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/gala/quickbooks/final-total", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.batch ? { batchId: state.batch.id } : { revision: state.revision, closeSales: confirm }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Result not confirmed. Refresh before retrying.");
      await load();
    } catch (e) { setState(null); setError((e as Error).message || "Result not confirmed. Refresh before retrying."); }
    finally { setBusy(false); setConfirm(false); }
  }
  if (hidden) return null;
  const batch = state?.batch;
  return <section className={styles.preview} aria-labelledby="final-send-title" aria-busy={busy}>
    <h3 id="final-send-title">Send final total · QuickBooks sandbox</h3>
    <p>This records one combined sale in the test books. It does not charge buyers or email them. Your item ledger stays available.</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" className={styles.secondary} disabled={busy} onClick={() => void load()}>{busy ? "Checking final total…" : "Refresh final total"}</button>
    {state && <>
      <p className={styles.finalAmount}>{money(batch?.amount ?? state.amount)}</p>
      <p>{batch?.orderCount ?? state.orderCount} paid orders · Symphony Ball Revenue · sales before processing fees</p>
      {batch ? <>
        <p role="status">{batch.status === "synced" ? `Sent to QuickBooks sandbox. Receipt ${batch.receiptId}.` : batch.status === "review" ? "The result needs checking. Check the saved entry before taking any other accounting action." : "The final total is saved. Sending is not yet confirmed."}</p>
        <p>Test sales are closed. The saved total and included orders cannot be changed.</p>
        <a href="/api/gala/quickbooks/final-total?format=saved" download>Download saved total and item details</a>
        {batch.status !== "synced" && <p><button type="button" disabled={busy || !state.enabled} onClick={() => void send()}>{batch.dispatched ? "Check QuickBooks for the saved entry" : "Send saved total to sandbox"}</button></p>}
      </> : <>
        {state.reasons.length > 0 && <ul>{state.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
        {!state.enabled && <p>Sandbox sending is turned off. The test organizer can enable it for an accounting rehearsal.</p>}
        {state.enabled && state.reasons.length === 0 && <>
          <p>Only do this at the end. Saving the final total closes new test purchases, even if QuickBooks needs another check.</p>
          <label><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} disabled={busy}/> I have reviewed all paid sales and am ready to close test sales.</label>
          <p><button type="button" disabled={busy || !confirm} onClick={() => void send()}>Close test sales and send total</button></p>
        </>}
      </>}
    </>}
  </section>;
}
