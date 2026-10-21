"use client";
import { useRef, useState, type FormEvent } from "react";
import ContactFields from "./ContactFields";
import styles from "./PatronForm.module.css";
import { paymentDraft, PAYMENT_DRAFT_KEY } from "./payment-browser";

export default function PatronSignup({ cardPayments = false }: { cardPayments?: boolean }) {
  const requestId = useRef("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const [method, setMethod] = useState<"card" | "check">(cardPayments ? "card" : "check");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    requestId.current ||= crypto.randomUUID();
    setBusy(true); setError("");
    try {
      const card = cardPayments && method === "card";
      const draft = card ? paymentDraft() : null;
      const response = await fetch(card ? "/api/patron/checkout" : "/api/patron", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: draft?.requestId || requestId.current, name: data.get("name"), email: data.get("email"), phone: data.get("phone"), consent: data.get("consent") === "on", company: data.get("company"), ...(draft ? { accessToken: draft.accessToken } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t save your signup. Please try again.");
      if (draft) {
        sessionStorage.setItem(PAYMENT_DRAFT_KEY, JSON.stringify({ ...draft, paymentId: result.id }));
        window.location.assign(result.url || `/patron/payment?payment=${encodeURIComponent(result.id)}`);
        return;
      }
      setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "We couldn’t save your signup. Please try again."); }
    finally { setBusy(false); }
  }
  if (saved) return <div className={styles.success} role="status">
    <p className="text-xl">Thank you for supporting the Guild!</p>
    <p className="mt-3">Your signup has been received. If you’ve already registered, we’ve kept your existing entry.</p>
    <p className="mt-3">New signups wait for Guild review. We’ll check your name before approving it for the thank-you section.</p>
    <p className="mt-3">No payment was collected. Please contact the Guild to arrange your $100 dues by check.</p>
  </div>;
  return <form className={styles.form} onSubmit={submit} onChange={() => { requestId.current = ""; }}>
    <fieldset className={styles.fields} disabled={busy}>
      <legend className="sr-only">Patron contact information</legend>
      <ContactFields prefix="patron" emailRequired />
      {cardPayments && <fieldset className={styles.fields}>
        <legend className="mb-3 font-medium">How would you like to pay your $100 dues?</legend>
        <label className={styles.consent}><input type="radio" name="payment-method" checked={method === "card"} onChange={() => setMethod("card")} /><span>Pay $100 by card through Stripe</span></label>
        <label className={styles.consent}><input type="radio" name="payment-method" checked={method === "check"} onChange={() => setMethod("check")} /><span>Arrange payment by check with the Guild</span></label>
        <p className={styles.hint}>One payment for this membership year. No automatic renewal.</p>
      </fieldset>}
      <div className={styles.trap} aria-hidden="true">
        <label htmlFor="patron-company">Leave this field empty</label>
        <input id="patron-company" name="company" type="text" autoComplete="off" tabIndex={-1} maxLength={200} />
      </div>
      <label className={styles.consent} htmlFor="patron-consent">
        <input id="patron-consent" name="consent" type="checkbox" required />
        <span>I agree to have my name displayed in the Patron thank-you section.</span>
      </label>
    </fieldset>
    <p className={styles.hint}>Your name will appear only after Guild review and approval. Your email and phone stay private for Guild administration. <a href="/privacy-policy" className="underline underline-offset-4">Privacy policy</a></p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button className={styles.button} type="submit" disabled={busy}>{busy ? "Submitting…" : cardPayments && method === "card" ? "Continue to Stripe · $100" : "Submit signup"}</button>
  </form>;
}
