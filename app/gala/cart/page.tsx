import { notFound } from "next/navigation";
import { requireGalaSalesPage } from "@/lib/gala/preview";
import { backendEnabled } from "@/lib/gala/backend/config";
import GalaShell from "@/components/gala/GalaShell";
import GalaCart from "@/components/gala/GalaCart";
import { SandboxAccess } from "@/components/gala/SandboxCheckout";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your cart | Symphony Ball 2027", robots: { index: false, follow: false } };
export default function CartPage() {
  requireGalaSalesPage();
  if (!backendEnabled(process.env)) notFound();
  return <GalaShell sandbox current="cart" title="Your Gala cart" intro="Bring your evening together. Review your tables, tickets, and celebration gifts, then pay once.">
    <SandboxAccess><GalaCart /></SandboxAccess>
  </GalaShell>;
}
