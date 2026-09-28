import GalaShell from "@/components/gala/GalaShell";
import OrderForm from "@/components/gala/OrderForm";
import { requireGalaPreview } from "@/lib/gala/preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Send an Invitation | Symphony Ball 2027", robots: { index: false, follow: false } };
export default function InvitationsPage() {
  requireGalaPreview();
  return <GalaShell current="invitations" title="An invitation to something special" intro="Share this evening with friends and family. Tell us who you would like to invite, and the Guild will address and mail an invitation on your behalf."><OrderForm kind="invitations" /></GalaShell>;
}
