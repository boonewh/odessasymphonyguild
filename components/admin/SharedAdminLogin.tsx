"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "./SharedAdmin.module.css";
export default function SharedAdminLogin({ destination, live = false }: { destination: string; live?: boolean }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(live ? "/api/admin/session" : "/api/admin/test-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (response.status === 429) throw new Error(`Too many sign-in attempts. Try again in ${Math.max(1, Math.ceil(Number(response.headers.get("Retry-After") || 300) / 60))} minutes.`);
      if (response.status === 401) throw new Error("That password didn’t match. Please try again.");
      if (!response.ok) throw new Error("Sign-in is temporarily unavailable. Please try again.");
      setPassword(""); window.location.replace(destination);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <main className={styles.loginPage}><section className={styles.loginPanel} aria-labelledby="admin-login-title">
    <p className={styles.eyebrow}>Odessa Symphony Guild{!live && " · Test site"}</p><h1 id="admin-login-title">Admin sign-in</h1><p>One password for Dues and Gala.</p>
    <form onSubmit={submit} className={styles.loginForm}><label htmlFor="shared-password">Password</label>
      <input id="shared-password" name="password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} aria-describedby={error ? "login-error" : undefined} />
      {error && <p id="login-error" role="alert" className={styles.error}>{error}</p>}
      <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form><p className={styles.hint}>{!live && "Use the existing test access code. "}Your admin sign-in lasts up to eight hours.</p><Link href={live ? "/" : "/gala/tables"}>{live ? "Return to website" : "Back to the Gala test site"}</Link>
  </section></main>;
}
