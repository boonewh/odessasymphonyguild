import { notFound } from "next/navigation";
import { backendEnabled } from "@/lib/gala/backend/config";
import PaymentLab from "@/components/gala/PaymentLab";
export const dynamic = "force-dynamic";
export const metadata = { title: "Local Gala Payment Testing", robots: { index: false, follow: false } };
export default function TestingPage() {
  if (!backendEnabled(process.env)) notFound();
  return <PaymentLab />;
}
