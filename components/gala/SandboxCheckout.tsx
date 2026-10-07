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
  useEffect(() => { void fetch("/api/gala/session", { cache: "no-store" }).then(async r => {
    if (r.ok) { setState("ready"); return; }
    const result = await r.json();
    if (result.accessMode === "individual") {
      const session = await fetch("/api/gala/session", { method: "POST" });
      if (!session.ok) throw new Error("Customer access unavailable.");
      setState("ready"); return;
    }
    setState("locked");
  })
    .catch(() => { setState("locked"); setError("The test site could not be reached. Try again."); }); }, []);
  async function unlock(event: FormEvent) {
    event.preventDefault(); setState("unlocking"); setError("");
    try {
      const r = await fetch("/api/gala/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (!r.ok) throw new Error("Check your test access code with the test organizer.");
      setToken(""); setState("ready");
    } catch (e) { setError((e as Error).message); setState("locked"); }
  }
  if (state === "ready") return children;
  if (state === "loading") return <p role="status">Checking test access…</p>;
  return <form onSubmit={unlock} className={styles.summary}><h2>Sign in to the test site</h2>
    <p>{invitations?"Use fictional names and mailing addresses. No invitations or emails are sent.":"Use fictional buyer details and Stripe test cards. No real payments are taken."}</p>
    <p>Use the access code provided by the test organizer.</p>
    <label className={styles.field}>Test access code<input required type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label>
    <button className={styles.primary} disabled={state === "unlocking"}>{state==="unlocking"?"Signing in…":"Sign in"}</button>
    {error && <p role="alert" className={styles.error}>{error}</p>}</form>;
}

type Summary = { id: string; status: "paid" | "expired" | "reserved" | "awaiting_payment"; kind: "tables" | "gifts"; amount: number; description: string };
export function SandboxOrderStatus({ id, retry, startAnother }: { id: string; retry?: () => Promise<void>; startAnother?: () => void }) {
  const [order, setOrder] = useState<Summary | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/gala/order?orderId=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (r.status === 401) throw new Error("Your session expired. Keep this order reference and contact staff before starting another purchase.");
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
      if (r.status === 401 || r.status === 403) throw new Error("Your test session expired. Reload this page to sign in again.");
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Payment status could not be verified.");
      if (action === "resume" && result.url) { window.location.assign(checkoutUrl(result.url)); return; }
      await refresh();
    } catch (e) { setError((e as Error).message); } finally { lock.current = false; setBusy(false); }
  }
  const closed = order?.status === "paid" || order?.status === "expired";
  return <section className={styles.summary} aria-label="Checkout status">
    <h2>{order?.status === "paid" ? "Test payment confirmed" : order?.status === "expired" ? "Checkout closed without payment" : "Your checkout is not yet confirmed"}</h2>
    <p role="status">{order?.status === "paid" ? "Your test payment is confirmed. You can now find this order in Gala admin."
      : order?.status === "expired" ? "Stripe confirmed this checkout expired unpaid. Any table held for it has been released."
        : "We are checking your payment. Please keep this order and use Check payment status below instead of starting another purchase. Your table stays reserved until the result is confirmed."}</p>
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
    <p className={styles.fine}>Test only. No real money is charged. <Link href="/gala/preview/admin">View in Gala admin</Link></p>
  </section>;
}

function SandboxForm({ kind }: { kind: "tables" | "gifts" }) {
  const [attempt, setAttempt] = useState<CheckoutRequest | null>(null), [ready, setReady] = useState(false);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    try { setAttempt(readAttempt(sessionStorage.getItem(FLYER_ATTEMPT_KEY))); setReady(true); }
    catch { setError("Your previous checkout could not be loaded. Check Gala admin for your order before starting another purchase."); }
  }, []);
  async function send(payload: CheckoutRequest) {
    setError("");
    const r = await fetch("/api/gala/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (r.status === 403) throw new Error("Your test session expired. Reload this page to sign in again.");
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
