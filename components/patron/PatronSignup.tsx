"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ContactFields from "./ContactFields";
import styles from "./PatronForm.module.css";

export default function PatronSignup() {
  const router = useRouter();
  const requestId = useRef("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    requestId.current ||= crypto.randomUUID();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/patron", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId.current, name: data.get("name"), email: data.get("email"), phone: data.get("phone"), consent: data.get("consent") === "on", company: data.get("company") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t save your signup. Please try again.");
      setSaved(true); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "We couldn’t save your signup. Please try again."); }
    finally { setBusy(false); }
  }
  if (saved) return <div className={styles.success} role="status">
    <p className="text-xl">Thank you for supporting the Guild!</p>
    <p className="mt-3">Your signup has been received. If you’ve already registered, we’ve kept your existing entry.</p>
    <p className="mt-3">This form does not collect payment. Please contact the Guild about your patron dues.</p>
    <a className="mt-4 inline-flex min-h-12 items-center underline underline-offset-4" href="#thank-you">Visit the thank-you section ↑</a>
  </div>;
  return <form className={styles.form} onSubmit={submit} onChange={() => { requestId.current = ""; }}>
    <fieldset className={styles.fields} disabled={busy}>
      <legend className="sr-only">Patron contact information</legend>
      <ContactFields prefix="patron" emailRequired />
      <div className={styles.trap} aria-hidden="true">
        <label htmlFor="patron-company">Leave this field empty</label>
        <input id="patron-company" name="company" type="text" autoComplete="off" tabIndex={-1} maxLength={200} />
      </div>
      <label className={styles.consent} htmlFor="patron-consent">
        <input id="patron-consent" name="consent" type="checkbox" required />
        <span>I agree to have my name displayed in the Patron thank-you section.</span>
      </label>
    </fieldset>
    <p className={styles.hint}>Only your name is public. Your email and phone are for Guild administration. <a href="/privacy-policy" className="underline underline-offset-4">Privacy policy</a></p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button className={styles.button} type="submit" disabled={busy}>{busy ? "Submitting…" : "Join our patrons"}</button>
  </form>;
}
