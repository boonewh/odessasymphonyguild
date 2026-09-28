import GalaShell from "@/components/gala/GalaShell";
import GalaAdmin from "@/components/gala/GalaAdmin";
import { requireGalaPreview } from "@/lib/gala/preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local Gala Admin Preview", robots: { index: false, follow: false } };
export default function AdminPreviewPage() {
  requireGalaPreview();
  return <GalaShell current="preview/admin" title="Behind a beautiful evening" intro="Review sample purchases, table holds, student gifts, and invitation requests. This is a local workflow preview, not the Guild’s live records."><GalaAdmin /></GalaShell>;
}
