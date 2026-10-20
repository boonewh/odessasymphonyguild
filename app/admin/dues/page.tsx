import { requireSharedAdmin } from "@/lib/admin/test-page";
import SharedAdminNav from "@/components/admin/SharedAdminNav";
import DuesSample from "@/components/admin/DuesSample";
import styles from "@/components/admin/SharedAdmin.module.css";
import { liveSiteEnabled } from "@/lib/gala/live-release";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = { title: "Dues Administration", robots: { index: false, follow: false } };
export default async function DuesAdministration() {
  await requireSharedAdmin("/admin/dues");
  if (liveSiteEnabled(process.env)) redirect("/admin/belles-beaux");
  return <div className={styles.page}><SharedAdminNav current="dues" /><DuesSample /></div>;
}
