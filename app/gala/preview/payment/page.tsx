import Link from "next/link";
import { requireGalaSalesPage } from "@/lib/gala/preview";
import { backendEnabled } from "@/lib/gala/backend/config";
import { SandboxAccess, SandboxOrderStatus } from "@/components/gala/SandboxCheckout";
import { z } from "zod";
import styles from "@/components/gala/PaymentLab.module.css";
import { liveSiteEnabled } from "@/lib/gala/live-release";
import { GalaRuntime } from "@/components/gala/GalaRuntime";
export const dynamic = "force-dynamic";
export default async function PaymentReturn({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  requireGalaSalesPage();
  const live = liveSiteEnabled(process.env);
  const parsed = z.uuid().safeParse((await searchParams).order_id);
  if (backendEnabled(process.env) && parsed.success) return <GalaRuntime live={live}><main className={styles.lab}>
    {!live && <span className={styles.badge}>TEST SITE · NO REAL PAYMENTS</span>}<h1>Your Gala order</h1>
    <SandboxAccess><SandboxOrderStatus key={parsed.data} id={parsed.data} returnToWebsite /></SandboxAccess>
  </main></GalaRuntime>;
  return <main style={{ maxWidth: 680, margin: "80px auto", padding: 24 }}>
    <h1>{live ? "Your Gala order" : "Gala payment testing"}</h1>
    <p>Your return to this page does not confirm payment. The server verifies Stripe’s payment status before an order is marked paid.</p>
    <p>Leaving checkout does not release a table immediately. Its checkout must be verified expired first.</p>
    <nav className={styles.nav} aria-label="Return navigation"><Link href="/">Return to website</Link></nav>
  </main>;
}
