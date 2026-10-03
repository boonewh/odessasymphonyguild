"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { OrderFormContent, type PaidFormDetails } from "./OrderForm";
import { checkoutRequest, type CheckoutRequest } from "@/lib/gala/checkout-request";
import { checkoutUrl, FLYER_ATTEMPT_KEY, readAttempt } from "@/lib/gala/checkout-attempt";
import { money } from "@/lib/gala/model";
import styles from "./gala-sales.module.css";

export function SandboxAccess({ children, invitations = false }: { children: ReactNode; invitations?: boolean }) {
  const [state, setState] = useState("loading"), [token, setToken] = useState(""), [error, setError] = useState("");
  useEffect(() => { void fetch("/api/gala/session", { cache: "no-store" }).then(r => setState(r.ok ? "ready" : "locked"))
    .catch(() => { setState("locked"); setError("Local server unavailable. Try again."); }); }, []);
  async function unlock(event: FormEvent) {
    event.preventDefault(); setState("unlocking"); setError("");
    try {
      const r = await fetch("/api/gala/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (!r.ok) throw new Error("Use the development token from your local .env.local file.");
      setToken(""); setState("ready");
    } catch (e) { setError((e as Error).message); setState("locked"); }
  }
  if (state === "ready") return children;
  if (state === "loading") return <p role="status">Checking local sandbox access…</p>;
  return <form onSubmit={unlock} className={styles.summary}><h2>{invitations?"Unlock local invitation testing":"Unlock local checkout testing"}</h2>
    <p>{invitations?"Use fictional names and mailing addresses. No invitations or emails are sent.":"Use fictional buyer details and Stripe test cards. No real payments are taken."}</p>
    <label className={styles.field}>Development token<input required type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label>
    <button className={styles.primary} disabled={state === "unlocking"}>Unlock sandbox</button>
    {error && <p role="alert" className={styles.error}>{error}</p>}</form>;
}

type Summary = { id: string; status: "paid" | "expired" | "reserved" | "awaiting_payment"; kind: "tables" | "gifts"; amount: number; description: string };
export function SandboxOrderStatus({ id, retry, startAnother }: { id: string; retry?: () => Promise<void>; startAnother?: () => void }) {
  const [order, setOrder] = useState<Summary | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/gala/order?orderId=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (r.status === 401) throw new Error("Your local session expired. Reload to unlock testing again.");
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || "Cannot verify this order yet.");
    setOrder(result.order); setError(""); return result.order as Summary;
  }, [id]);
  useEffect(() => {
    void refresh().catch(e => setError(e.message));
    const interval = setInterval(() => { void refresh().catch(e => setError(e.message)); }, 5000);
    return () => clearInterval(interval);
  }, [refresh]);
  async function act(action: "check" | "resume" | "expire") {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      if (action === "resume" && retry) { await retry(); return; }
      const r = await fetch(action === "expire" ? "/api/gala/expire" : `/api/gala/order?orderId=${encodeURIComponent(id)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "expire" ? { orderId: id } : {}),
      });
      if (r.status === 401 || r.status === 403) throw new Error("Your local session expired. Reload to unlock testing again.");
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Payment status could not be verified.");
      if (action === "resume" && result.url) { window.location.assign(checkoutUrl(result.url)); return; }
      await refresh();
    } catch (e) { setError((e as Error).message); } finally { lock.current = false; setBusy(false); }
  }
  const closed = order?.status === "paid" || order?.status === "expired";
  return <section className={styles.summary} aria-label="Checkout status">
    <h2>{order?.status === "paid" ? "Test payment confirmed" : order?.status === "expired" ? "Checkout closed without payment" : "Your checkout is not yet confirmed"}</h2>
    <p role="status">{order?.status === "paid" ? "Stripe payment has been verified. Your order is ready for fulfillment in the sandbox admin."
      : order?.status === "expired" ? "Stripe confirmed this checkout expired unpaid. Any table held for it has been released."
        : "Returning here does not confirm payment or release a table. Your selections remain locked until the server verifies payment or expiry."}</p>
    <p className={styles.fine}>Order reference: <span style={{ overflowWrap: "anywhere" }}>{id}</span></p>
    {order && <p>{order.description} · <strong>{money(order.amount)}</strong></p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!closed && <div className={styles.actions}>
      <button className={styles.primary} disabled={busy} onClick={() => void act("resume")}>Resume the same checkout</button>
      <button className={styles.secondary} disabled={busy} onClick={() => void act("check")}>Check payment status</button>
      {order && <button className={styles.secondary} disabled={busy} onClick={() => void act("expire")}>Cancel unpaid checkout</button>}
    </div>}
    {closed && (startAnother ? <button className={styles.primary} onClick={startAnother}>Start another test order</button>
      : <Link href={`/gala/${order.kind}`}>Return to {order.kind === "tables" ? "tables and tickets" : "celebration gifts"}</Link>)}
    <p className={styles.fine}>Local sandbox only. No real money is charged. <Link href="/gala/preview/admin">View test orders</Link></p>
  </section>;
}

function SandboxForm({ kind }: { kind: "tables" | "gifts" }) {
  const [attempt, setAttempt] = useState<CheckoutRequest | null>(null), [ready, setReady] = useState(false);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    try { setAttempt(readAttempt(sessionStorage.getItem(FLYER_ATTEMPT_KEY))); setReady(true); }
    catch { setError("The saved checkout could not be read. Check the sandbox admin before clearing browser storage or making another purchase."); }
  }, []);
  async function send(payload: CheckoutRequest) {
    setError("");
    const r = await fetch("/api/gala/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (r.status === 403) throw new Error("Your local session expired. Reload to unlock testing again.");
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || "Checkout could not be opened. Retry this same order.");
    window.location.assign(checkoutUrl(result.url));
  }
  async function checkout(details: PaidFormDetails) {
    if (lock.current || attempt) return; lock.current = true; setBusy(true); setError("");
    try {
      const payload = checkoutRequest.parse({ ...details, requestId: crypto.randomUUID() });
      // Persist before sending; an interrupted response must reuse the same ID and details.
      sessionStorage.setItem(FLYER_ATTEMPT_KEY, JSON.stringify(payload)); setAttempt(payload);
      await send(payload);
    } catch (e) { setError((e as Error).message); } finally { lock.current = false; setBusy(false); }
  }
  function reset() {
    try { sessionStorage.removeItem(FLYER_ATTEMPT_KEY); setAttempt(null); setError(""); }
    catch { setError("Browser storage could not be updated. Reload before starting another order."); }
  }
  return <>{error && <p role="alert" className={styles.error}>{error}</p>}
    {!ready ? <p>Checking saved checkout…</p> : attempt
      ? <SandboxOrderStatus id={attempt.requestId} retry={() => send(attempt)} startAnother={reset} />
      : <OrderFormContent kind={kind} checkout={checkout} busy={busy} />}</>;
}
export default function SandboxCheckout({ kind }: { kind: "tables" | "gifts" }) {
  return <SandboxAccess><SandboxForm kind={kind} /></SandboxAccess>;
}
