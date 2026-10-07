"use client";
import { useCallback, useEffect, useState } from "react";
import styles from "./PaymentLab.module.css";
import { accountingLabel } from "@/lib/gala/display";

type Setup = { configured: boolean; connected: boolean; mapped: boolean; databaseReady: boolean; syncEnabled: boolean; missing: string[] };
export default function QuickBooksSandbox({ orders, refresh }: {
  orders: { id: string; label: string; accountingStatus: string }[]; refresh: () => Promise<void>;
}) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/gala/quickbooks/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not read QuickBooks sandbox setup.");
    setSetup(await response.json());
  }, []);
  useEffect(() => { void load().catch(e => setMessage(e.message)); }, [load]);
  async function action(kind: "connect" | "sync", orderId?: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/gala/quickbooks/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sandbox operation failed.");
      if (kind === "connect") { window.location.assign(result.url); return; }
      setMessage(result.state === "synced" ? "Verified sales receipt in the QuickBooks sandbox. No live books were changed."
        : result.state === "review" ? "Accounting needs review. An uncertain sale will not be posted again; Retry lookup checks for its existing receipt."
        : "This order is already synced or another operation is running. Refresh its status.");
      await refresh(); await load();
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  const ready = setup?.connected && setup.mapped && setup.databaseReady && setup.syncEnabled;
  return <section className={styles.panel}>
    <h2>Test accounting</h2>
    <p className={styles.note}>See which paid test orders have been recorded in the QuickBooks test company. Recording an order does not charge the buyer again or change the Guild’s live books.</p>
    <p>{!setup ? "Checking accounting availability…" : !ready
      ? "Sending orders to QuickBooks is turned off or not ready. Unsent orders are not processing; waiting will not send them."
      : "Test accounting is enabled. Each order is sent only when you select it."}</p>
    <details><summary>Accounting setup — for the test organizer</summary>
    <p>{!setup ? "Checking setup…" : !setup.configured ? "Test accounting credentials are not configured."
      : !setup.databaseReady ? "Test accounting storage needs setup."
      : !setup.connected ? "The QuickBooks test company needs to be connected."
      : !setup.mapped ? "The test company's accounting categories need setup."
      : !setup.syncEnabled ? "Connected. Sending test orders is disabled."
      : "Connected and ready for test orders."}</p>
    <p>The test records one sales receipt per paid order. Final posting rules, fees and payouts still need the treasurer’s review.</p>
    <div className={styles.tools}>
      <button disabled={busy || !setup?.configured || !setup.databaseReady} onClick={() => void action("connect")}>{setup?.connected ? "Reconnect test company" : "Connect QuickBooks test company"}</button>
      <button disabled={busy} onClick={() => void load().catch(e => setMessage(e.message))}>Refresh setup</button>
    </div>
    </details>
    {message && <p role="status">{message}</p>}
    {orders.map(order => <div key={order.id} className={styles.tools}>
      <span>{order.label} · {accountingLabel(order.accountingStatus)}</span>
      {order.accountingStatus !== "synced" && <button disabled={busy || !ready} onClick={() => void action("sync", order.id)}>
        {order.accountingStatus === "review" || order.accountingStatus === "processing" ? "Check for an existing receipt" : "Record in QuickBooks test company"}
      </button>}
    </div>)}
  </section>;
}
