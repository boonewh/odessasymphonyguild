import { requireGalaPreview } from "@/lib/gala/preview";
import { backendEnabled } from "@/lib/gala/backend/config";
import { SandboxAccess, SandboxOrderStatus } from "@/components/gala/SandboxCheckout";
import { z } from "zod";
import styles from "@/components/gala/PaymentLab.module.css";
export const dynamic = "force-dynamic";
export default async function PaymentReturn({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  requireGalaPreview();
  const parsed = z.uuid().safeParse((await searchParams).order_id);
  if (backendEnabled(process.env) && parsed.success) return <main className={styles.lab}>
    <span className={styles.badge}>LOCAL SANDBOX · NO REAL PAYMENTS</span><h1>Your Gala order</h1>
    <SandboxAccess><SandboxOrderStatus key={parsed.data} id={parsed.data} /></SandboxAccess>
  </main>;
  return <main style={{ maxWidth: 680, margin: "80px auto", padding: 24 }}>
    <h1>Gala payment testing</h1>
    <p>Your return to this page does not confirm payment. The server verifies Stripe’s payment status before an order is marked paid.</p>
    <p>Leaving checkout does not release a table immediately. Its checkout must be verified expired first.</p>
    <a href="/gala/tables">Return to the Gala preview</a>
  </main>;
}
