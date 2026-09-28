import GalaShell from "@/components/gala/GalaShell";
import OrderForm from "@/components/gala/OrderForm";
import { requireGalaPreview } from "@/lib/gala/preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Celebration Gifts | Symphony Ball 2027", robots: { index: false, follow: false } };
export default function GiftsPage() {
  requireGalaPreview();
  return <GalaShell current="gifts" title="A little gift. A proud moment." intro="Celebrate your Belle or Beau’s accomplishments with roses and cookies. Remember their friends, too—add a personal celebration for each student."><OrderForm kind="gifts" /></GalaShell>;
}
