import GalaShell from "@/components/gala/GalaShell";
import OrderForm from "@/components/gala/OrderForm";
import { requireGalaPage } from "@/lib/gala/preview";
import { backendEnabled } from "@/lib/gala/backend/config";
import SandboxCheckout from "@/components/gala/SandboxCheckout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tables & Tickets | Symphony Ball 2027", robots: { index: false, follow: false } };
export default function TablesPage() {
  const clientReview = requireGalaPage();
  const sandbox = !clientReview && backendEnabled(process.env);
  return <GalaShell clientReview={clientReview} sandbox={sandbox} current="tables" title="Table & ticket purchases" intro="Join us for an elegant dinner, a live auction, student presentations, and a lively dance—all in support of the arts in the Permian Basin.">{sandbox ? <SandboxCheckout kind="tables" /> : <OrderForm clientReview={clientReview} kind="tables" />}</GalaShell>;
}
