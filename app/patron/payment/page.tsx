import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PatronPaymentStatus from "@/components/patron/PatronPaymentStatus";
import { patronPaymentsEnabled } from "@/lib/patron/payment-config";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = { title: "Patron payment | Odessa Symphony Guild", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function PatronPaymentPage() {
  if (!patronPaymentsEnabled()) notFound();
  return <><Header /><main className="mx-auto max-w-3xl px-6 py-16"><PatronPaymentStatus /></main><Footer /></>;
}
