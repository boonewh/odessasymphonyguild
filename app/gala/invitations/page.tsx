import GalaShell from "@/components/gala/GalaShell";
import OrderForm from "@/components/gala/OrderForm";
import { requireGalaPage } from "@/lib/gala/preview";
import { backendEnabled } from "@/lib/gala/backend/config";
import SandboxInvitations from "@/components/gala/SandboxInvitations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Send an Invitation | Symphony Ball 2027", robots: { index: false, follow: false } };
export default function InvitationsPage() {
  const clientReview = requireGalaPage();
  const sandbox=!clientReview&&backendEnabled(process.env);
  return <GalaShell clientReview={clientReview} sandbox={sandbox} current="invitations" title="Want to send an invitation?" intro="Share this special evening with your friends and family! Complete the information below to have a Symphony Ball invitation mailed on your behalf.">{sandbox?<SandboxInvitations/>:<OrderForm clientReview={clientReview} kind="invitations" />}</GalaShell>;
}
