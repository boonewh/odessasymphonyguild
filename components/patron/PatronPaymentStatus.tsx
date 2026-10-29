"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PAYMENT_DRAFT_KEY, type PaymentDraft } from "./payment-browser";
import styles from "./PatronForm.module.css";
type Status = { status: "pending" | "paid" | "expired"; url: string | null; needsReview: boolean };
export default function PatronPaymentStatus() {
  const [state, setState] = useState<Status | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const id = new URLSearchParams(window.location.search).get("payment");
      const draft = JSON.parse(sessionStorage.getItem(PAYMENT_DRAFT_KEY) || "null") as PaymentDraft | null;
      if (!id || !draft?.accessToken) throw new Error("Please open this page in the browser tab where you started payment, or contact the Guild for help.");
      const response = await fetch("/api/patron/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, accessToken: draft.accessToken }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Payment confirmation is temporarily unavailable.");
      setState(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Payment confirmation is temporarily unavailable."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  function startAgain() { sessionStorage.removeItem(PAYMENT_DRAFT_KEY); window.location.assign("/patron#become-a-patron"); }
  return <div className={styles.form}>
    {busy && <p role="status">Checking your payment with Stripe…</p>}
    {error && <p className={styles.error} role="alert">{error} Please don’t make another payment while confirmation is unavailable.</p>}
    {!busy && !error && state && <>
      <h1 className="text-3xl">{state.status === "paid" ? "Thank you for your $100 Patron payment" : state.status === "expired" ? "This checkout has expired" : "Your payment is not confirmed yet"}</h1>
      <p>{state.status === "paid" ? "Your dues payment is confirmed. The Guild will review your name separately before it appears in the thank-you section." : state.status === "expired" ? "Stripe has confirmed that this checkout is unpaid. You can start a new payment below." : state.needsReview ? "Please contact the Guild so we can check the earlier checkout attempt before you pay again." : "If you left Stripe before paying, you can return to the same checkout. If you already paid, check the status again in a moment."}</p>
      {state.status === "pending" && state.url && <a className={styles.button} href={state.url}>Return to secure checkout</a>}
      {state.status === "expired" && <button className={styles.button} onClick={startAgain}>Start a new payment</button>}
    </>}
    {state?.status !== "paid" && <button className={styles.secondary} disabled={busy} onClick={() => void load()}>Check payment status</button>}
    <Link href="/#contact" className="underline underline-offset-4">Contact the Guild for help</Link>
    <a href="/patron" className="underline underline-offset-4">Back to Patrons</a>
  </div>;
}
