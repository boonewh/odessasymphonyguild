import GalaShell from "@/components/gala/GalaShell";
import OrderForm from "@/components/gala/OrderForm";
import { requireGalaPreview } from "@/lib/gala/preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Send an Invitation | Symphony Ball 2027", robots: { index: false, follow: false } };
export default function InvitationsPage() {
  requireGalaPreview();
  return <GalaShell current="invitations" title="Want to send an invitation?" intro="Share this special evening with your friends and family! Complete the information below to have a Symphony Ball invitation mailed on your behalf."><OrderForm kind="invitations" /></GalaShell>;
}
