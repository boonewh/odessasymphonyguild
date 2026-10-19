import { requireSharedAdmin } from "@/lib/admin/test-page";
import SharedAdminNav from "@/components/admin/SharedAdminNav";
import DuesSample from "@/components/admin/DuesSample";
import styles from "@/components/admin/SharedAdmin.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Dues Administration · Test Site", robots: { index: false, follow: false } };
export default async function DuesAdministration() {
  await requireSharedAdmin("/admin/dues");
  return <div className={styles.page}><SharedAdminNav current="dues" /><DuesSample /></div>;
}
