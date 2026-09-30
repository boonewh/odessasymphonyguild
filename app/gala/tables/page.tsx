import GalaShell from "@/components/gala/GalaShell";
import OrderForm from "@/components/gala/OrderForm";
import { requireGalaPreview } from "@/lib/gala/preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tables & Tickets | Symphony Ball 2027", robots: { index: false, follow: false } };
export default function TablesPage() {
  requireGalaPreview();
  return <GalaShell current="tables" title="Table & ticket purchases" intro="Join us for an elegant dinner, a live auction, student presentations, and a lively dance—all in support of the arts in the Permian Basin."><OrderForm kind="tables" /></GalaShell>;
}
