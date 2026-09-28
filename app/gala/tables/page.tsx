import GalaShell from "@/components/gala/GalaShell";
import OrderForm from "@/components/gala/OrderForm";
import { requireGalaPreview } from "@/lib/gala/preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tables & Tickets | Symphony Ball 2027", robots: { index: false, follow: false } };
export default function TablesPage() {
  requireGalaPreview();
  return <GalaShell current="tables" title="An evening worth sharing" intro="Gather your favorite people for dinner, a live auction, student presentations, and dancing—all in support of the arts in West Texas."><OrderForm kind="tables" /></GalaShell>;
}
