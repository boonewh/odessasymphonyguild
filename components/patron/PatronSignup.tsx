"use client";
import { useState, type FormEvent } from "react";
import ContactFields from "./ContactFields";
import styles from "./PatronForm.module.css";
import { paymentDraft, PAYMENT_DRAFT_KEY } from "./payment-browser";

export default function PatronSignup() {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const draft = paymentDraft();
      const response = await fetch("/api/patron/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: draft.requestId, name: data.get("name"), email: data.get("email"), phone: data.get("phone"), consent: data.get("consent") === "on", company: data.get("company"), accessToken: draft.accessToken }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t open checkout. Please retry in this tab.");
      sessionStorage.setItem(PAYMENT_DRAFT_KEY, JSON.stringify({ ...draft, paymentId: result.id }));
      window.location.assign(result.url || `/patron/payment?payment=${encodeURIComponent(result.id)}`);
    } catch (e) { setError(e instanceof Error ? e.message : "We couldn’t open checkout. Please retry in this tab."); }
    finally { setBusy(false); }
  }
  return <form className={styles.form} onSubmit={submit}>
    <fieldset className={styles.fields} disabled={busy}>
      <legend className="sr-only">Patron contact information</legend>
      <ContactFields prefix="patron" emailRequired />
      <p className={styles.hint}>Pay $100 securely by card through Stripe. One payment for this membership year. No automatic renewal.</p>
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
    <button className={styles.button} type="submit" disabled={busy}>{busy ? "Submitting…" : "Continue to Stripe · $100"}</button>
  </form>;
}
