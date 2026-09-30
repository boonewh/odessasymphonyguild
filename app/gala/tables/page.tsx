import GalaShell from "@/components/gala/GalaShell";
import OrderForm from "@/components/gala/OrderForm";
import { requireGalaPage } from "@/lib/gala/preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tables & Tickets | Symphony Ball 2027", robots: { index: false, follow: false } };
export default function TablesPage() {
  const clientReview = requireGalaPage();
  return <GalaShell clientReview={clientReview} current="tables" title="Table & ticket purchases" intro="Join us for an elegant dinner, a live auction, student presentations, and a lively dance—all in support of the arts in the Permian Basin."><OrderForm clientReview={clientReview} kind="tables" /></GalaShell>;
}
