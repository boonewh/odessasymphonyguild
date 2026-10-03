"use client";
import { useCallback, useEffect, useState } from "react";
import styles from "./PaymentLab.module.css";

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
    <h2>QuickBooks sandbox accounting</h2>
    <p className={styles.note}>Each paid order becomes one sales receipt with one Symphony Ball line. This records the Stripe payment; it does not charge the buyer again or send an invoice. Fees and payouts are not synced yet.</p>
    <p>{!setup ? "Checking sandbox setup…" : !setup.configured ? "Sandbox credentials are not configured."
      : !setup.databaseReady ? "The development accounting migration is required."
      : !setup.connected ? "Ready to authorize the designated sandbox company."
      : !setup.mapped ? "Connected. Set the sandbox customer, product, revenue and clearing account IDs."
      : !setup.syncEnabled ? "Configured. Sandbox writes are disabled."
      : "Sandbox sync enabled. Each order below is sent only when you select it."}</p>
    <div className={styles.tools}>
      <button disabled={busy || !setup?.configured || !setup.databaseReady} onClick={() => void action("connect")}>{setup?.connected ? "Reconnect sandbox" : "Connect QuickBooks sandbox"}</button>
      <button disabled={busy} onClick={() => void load().catch(e => setMessage(e.message))}>Refresh setup</button>
    </div>
    {message && <p role="status">{message}</p>}
    {orders.map(order => <div key={order.id} className={styles.tools}>
      <span>{order.label} · {order.accountingStatus}</span>
      {order.accountingStatus !== "synced" && <button disabled={busy || !ready} onClick={() => void action("sync", order.id)}>
        {order.accountingStatus === "review" || order.accountingStatus === "processing" ? "Retry receipt lookup" : "Sync to QB sandbox"}
      </button>}
    </div>)}
  </section>;
}
