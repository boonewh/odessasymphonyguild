import { requireGalaPreview } from "@/lib/gala/preview";
import { backendEnabled } from "@/lib/gala/backend/config";
import PaymentLab from "@/components/gala/PaymentLab";
export const dynamic = "force-dynamic";
export default function PaymentReturn() {
  requireGalaPreview();
  if (backendEnabled(process.env)) return <PaymentLab mode="admin" />;
  return <main style={{ maxWidth: 680, margin: "80px auto", padding: 24 }}>
    <h1>Gala payment testing</h1>
    <p>Your return to this page does not confirm payment. The server verifies Stripe’s payment status before an order is marked paid.</p>
    <p>Leaving checkout does not release a table immediately. Its checkout must be verified expired first.</p>
    <a href="/gala/tables">Return to the Gala preview</a>
  </main>;
}
