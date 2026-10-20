import { liveSiteEnabled } from "@/lib/gala/live-release";
import { requireSharedAdmin } from "@/lib/admin/test-page";
import SharedAdminNav from "@/components/admin/SharedAdminNav";
import { GalaRuntime } from "@/components/gala/GalaRuntime";
import PaymentLab from "@/components/gala/PaymentLab";
export const dynamic = "force-dynamic";
export const metadata = { title: "Gala Administration", robots: { index: false, follow: false } };
export default async function GalaAdministration() {
  const live = liveSiteEnabled(process.env);
  await requireSharedAdmin("/admin/gala");
  return <GalaRuntime live={live}><SharedAdminNav live={live} current="gala" /><PaymentLab mode="admin" sharedAdmin live={live} /></GalaRuntime>;
}
