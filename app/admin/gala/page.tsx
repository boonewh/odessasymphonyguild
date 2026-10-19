import { requireSharedAdmin } from "@/lib/admin/test-page";
import SharedAdminNav from "@/components/admin/SharedAdminNav";
import PaymentLab from "@/components/gala/PaymentLab";
export const dynamic = "force-dynamic";
export const metadata = { title: "Gala Administration · Test Site", robots: { index: false, follow: false } };
export default async function GalaAdministration() {
  await requireSharedAdmin("/admin/gala");
  return <><SharedAdminNav current="gala" /><PaymentLab mode="admin" sharedAdmin /></>;
}
