import { requireGalaPreview } from "@/lib/gala/preview";
export default function PaymentReturn() {
  requireGalaPreview();
  return <main style={{ maxWidth: 680, margin: "80px auto", padding: 24 }}>
    <h1>Gala payment testing</h1>
    <p>Your return to this page does not confirm payment. The server verifies Stripe’s payment status before an order is marked paid.</p>
    <p>Leaving checkout does not release a table immediately. Its checkout must be verified expired first.</p>
    <a href="/gala/tables">Return to the Gala preview</a>
  </main>;
}
