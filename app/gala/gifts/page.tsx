import GalaShell from "@/components/gala/GalaShell";
import OrderForm from "@/components/gala/OrderForm";
import { requireGalaPage } from "@/lib/gala/preview";
import { backendEnabled } from "@/lib/gala/backend/config";
import SandboxCheckout from "@/components/gala/SandboxCheckout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Celebration Gifts | Symphony Ball 2027", robots: { index: false, follow: false } };
export default function GiftsPage() {
  const clientReview = requireGalaPage();
  const sandbox = !clientReview && backendEnabled(process.env);
  return <GalaShell clientReview={clientReview} sandbox={sandbox} current="gifts" title="A little gift. A proud moment." intro="Celebrate your Belle or Beau’s accomplishments with roses and cookies. Remember their friends, too—add a personal celebration for each student.">{sandbox ? <SandboxCheckout kind="gifts" /> : <OrderForm clientReview={clientReview} kind="gifts" />}</GalaShell>;
}
