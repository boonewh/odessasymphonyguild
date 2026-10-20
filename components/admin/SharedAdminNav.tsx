"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { clearShoppingDetails } from "@/lib/gala/cart-storage";
import styles from "./SharedAdmin.module.css";
export default function SharedAdminNav({ current, live = false }: { current: "home" | "dues" | "gala"; live?: boolean }) {
  const endpoint = live ? "/api/admin/session" : "/api/admin/test-session";
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const check = async () => {
      try { const r = await fetch(endpoint, { cache: "no-store" });
        if (active && r.status === 401) window.location.replace("/admin/login");
      } catch { /* Data requests still enforce authorization. */ }
    };
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    void check();
    window.addEventListener("pageshow", check); window.addEventListener("focus", check); document.addEventListener("visibilitychange", visible);
    return () => { active = false; window.removeEventListener("pageshow", check); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", visible); };
  }, [endpoint]);
  async function logout() {
    setBusy(true); setError("");
    try {
      const r = await fetch(endpoint, { method: "DELETE" });
      if (!r.ok) throw new Error("Could not sign out. Please try again.");
      try { if (!live) clearShoppingDetails(sessionStorage); } catch { /* Cookie sign-out already succeeded. */ }
      window.location.replace("/admin/login");
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  const links = <><Link href="/admin" aria-current={current === "home" ? "page" : undefined}>Admin home</Link><Link href="/admin/dues" aria-current={current === "dues" ? "page" : undefined}>Dues</Link><Link href="/admin/gala" aria-current={current === "gala" ? "page" : undefined}>Gala</Link></>;
  return <header className={styles.header}><div className={styles.headerInner}>
    <Link href="/admin" className={styles.brand}>OSG Administration</Link>
    <nav className={styles.desktopNav} aria-label="Administration">{links}</nav>
    <button type="button" disabled={busy} onClick={() => void logout()}>{busy ? "Signing out…" : "Sign out"}</button>
    <details className={styles.mobileNav}><summary>Menu</summary><nav aria-label="Administration">{links}</nav></details>
  </div>{error && <p role="alert" className={styles.error}>{error}</p>}</header>;
}
