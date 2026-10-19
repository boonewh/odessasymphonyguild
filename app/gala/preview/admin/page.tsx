import GalaShell from "@/components/gala/GalaShell";
import GalaAdmin from "@/components/gala/GalaAdmin";
import { requireGalaPreview } from "@/lib/gala/preview";
import { backendEnabled } from "@/lib/gala/backend/config";
import PaymentLab from "@/components/gala/PaymentLab";
import { sharedAdminTestEnabled } from "@/lib/admin/test-access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gala Admin · Test Site", robots: { index: false, follow: false } };
export default function AdminPreviewPage() {
  requireGalaPreview(true);
  if (sharedAdminTestEnabled(process.env)) redirect("/admin/gala");
  if (backendEnabled(process.env)) return <PaymentLab mode="admin" individual={process.env.GALA_ACCESS_MODE === "individual"} />;
  return <GalaShell current="preview/admin" title="Behind a beautiful evening" intro="Review sample purchases, table holds, student gifts, and invitation requests. This is a local workflow preview, not the Guild’s live records."><GalaAdmin /></GalaShell>;
}
