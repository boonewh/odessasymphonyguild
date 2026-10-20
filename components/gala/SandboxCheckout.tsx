"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { CartCatalog, cartChanged } from "./GalaCart";
import { finishPaidCart, checkoutReference, CHECKOUT_REFERENCE_KEY } from "@/lib/gala/cart-storage";
import { checkoutUrl, FLYER_ATTEMPT_KEY, readAttempt } from "@/lib/gala/checkout-attempt";
import { money } from "@/lib/gala/model";
import styles from "./gala-sales.module.css";
import { useLiveGala } from "./GalaRuntime";

export function SandboxAccess({ children, invitations = false }: { children: ReactNode; invitations?: boolean }) {
  const live = useLiveGala();
  const [state, setState] = useState("loading"), [token, setToken] = useState(""), [error, setError] = useState("");
  useEffect(() => { void fetch("/api/gala/session", { cache: "no-store" }).then(async r => {
    if (r.ok) { setState("ready"); return; }
    const result = await r.json();
    if (result.accessMode === "individual" || result.accessMode === "live") {
      const session = await fetch("/api/gala/session", { method: "POST" });
      if (!session.ok) throw new Error("Customer access unavailable.");
      setState("ready"); return;
    }
    setState("locked");
  })
    .catch(() => { setState("locked"); setError("The site could not be reached. Try again."); }); }, []);
  async function unlock(event: FormEvent) {
    event.preventDefault(); setState("unlocking"); setError("");
    try {
      const r = await fetch("/api/gala/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (!r.ok) throw new Error("Check your test access code with the test organizer.");
      setToken(""); setState("ready");
    } catch (e) { setError((e as Error).message); setState("locked"); }
  }
  if (state === "ready") return children;
  if (state === "loading") return <p role="status">{live ? "Preparing your session…" : "Checking test access…"}</p>;
  if (live) return <div className={styles.summary}><p role="alert">{error || "Your session could not be prepared. Please reload to try again."}</p><button type="button" className={styles.primary} onClick={() => window.location.reload()}>Try again</button></div>;
  return <form onSubmit={unlock} className={styles.summary}><h2>Sign in to the test site</h2>
    <p>{invitations?"Use fictional names and mailing addresses. No invitations or emails are sent.":"Use fictional buyer details and Stripe test cards. No real payments are taken."}</p>
    <p>Use the access code provided by the test organizer.</p>
    <label className={styles.field}>Test access code<input required type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label>
    <button className={styles.primary} disabled={state === "unlocking"}>{state==="unlocking"?"Signing in…":"Sign in"}</button>
    {error && <p role="alert" className={styles.error}>{error}</p>}</form>;
}

type Summary = { id: string; status: "paid" | "expired" | "reserved" | "awaiting_payment"; kind: "tables" | "gifts" | "cart"; amount: number; description: string; lines?: { name: string; amount: number }[] };
export function SandboxOrderStatus({ id, retry, startAnother, returnToWebsite = false }: { id: string; retry?: () => Promise<void>; startAnother?: () => void; returnToWebsite?: boolean }) {
  const live = useLiveGala();
  const [order, setOrder] = useState<Summary | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/gala/order?orderId=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (r.status === 401) throw new Error("Your session expired. Keep this order reference and contact staff before starting another purchase.");
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || "Cannot verify this order yet.");
    if (result.order.status === "paid") { finishPaidCart(sessionStorage, id); cartChanged(); }
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
      const attempt = action === "resume" ? readAttempt(sessionStorage.getItem(FLYER_ATTEMPT_KEY)) : null;
      if (attempt?.requestId === id) {
        const response = await fetch("/api/gala/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(attempt) });
        const result = await response.json();
        if (!response.ok) {
          if (result.code === "CART_UNAVAILABLE") {
            sessionStorage.removeItem(FLYER_ATTEMPT_KEY); sessionStorage.removeItem(CHECKOUT_REFERENCE_KEY); cartChanged();
          }
          throw new Error(result.error || "Checkout is not confirmed. Check payment status before starting another order.");
        }
        window.location.assign(checkoutUrl(result.url)); return;
      }
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
    <h2>{order?.status === "paid" ? live ? "Payment confirmed" : "Test payment confirmed" : order?.status === "expired" ? "Checkout closed without payment" : "Your checkout is not yet confirmed"}</h2>
    <p role="status">{order?.status === "paid" ? live ? "Thank you. Your payment is confirmed. Please keep your order reference." : "Your test payment is confirmed. You can now find this order in Gala admin."
      : order?.status === "expired" ? "Stripe confirmed this checkout expired unpaid. Any table held for it has been released."
        : "We are checking your payment. Please keep this order and use Check payment status below instead of starting another purchase. Any tables stay reserved until the result is confirmed."}</p>
    <p className={styles.fine}>Order reference: <span style={{ overflowWrap: "anywhere" }}>{id}</span></p>
    {order && <p>{order.description} · <strong>{money(order.amount)}</strong></p>}
    {order?.lines && <ul>{order.lines.map((line,i) => <li key={i}>{line.name} · {money(line.amount)}</li>)}</ul>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!closed && <div className={styles.actions}>
      <button className={styles.primary} disabled={busy} onClick={() => void act("resume")}>Resume the same checkout</button>
      <button className={styles.secondary} disabled={busy} onClick={() => void act("check")}>Check payment status</button>
      {order && <button className={styles.secondary} disabled={busy} onClick={() => void act("expire")}>Cancel unpaid checkout</button>}
    </div>}
    {closed && (startAnother ? <button className={styles.primary} onClick={startAnother}>{order.status === "expired" ? "Return to your saved cart" : "Start another test order"}</button>
      : <div className={styles.actions}>
        {(!returnToWebsite || order.status === "expired") && <Link className={styles.secondary} href="/gala/cart" onClick={event => {
        try {
          if (checkoutReference(sessionStorage) === id) {
            sessionStorage.removeItem(FLYER_ATTEMPT_KEY); sessionStorage.removeItem(CHECKOUT_REFERENCE_KEY); cartChanged();
          }
        } catch { event.preventDefault(); setError("Your browser storage could not be updated. Reload before starting another order."); }
      }}>Return to your cart</Link>}
        {returnToWebsite && <Link className={styles.primary} href="/">Return to website</Link>}
      </div>)}
    {!live && <p className={styles.fine}>Test only. No real money is charged. <Link href="/gala/preview/admin">View in Gala admin</Link></p>}
  </section>;
}

export default function SandboxCheckout({ kind }: { kind: "tables" | "gifts" }) {
  return <SandboxAccess><CartCatalog kind={kind} /></SandboxAccess>;
}
