import { notFound } from "next/navigation";
import Link from "next/link";
import SharedAdminNav from "@/components/admin/SharedAdminNav";
import styles from "@/components/admin/SharedAdmin.module.css";
import PatronAdmin from "@/components/patron/PatronAdmin";
import { requireSharedAdmin } from "@/lib/admin/test-page";
import { liveSiteEnabled } from "@/lib/gala/live-release";
import { patronEnabled } from "@/lib/patron/config";
import { PATRON_PERIOD } from "@/lib/patron/model";

export const dynamic = "force-dynamic";
export const metadata = { title: "Patron Administration | OSG", robots: { index: false, follow: false } };
export default async function PatronAdminPage() {
  if (!patronEnabled()) notFound();
  await requireSharedAdmin("/admin/patron");
  const live = liveSiteEnabled(process.env);
  return <div className={styles.page}>
    <SharedAdminNav current="patron" live={live} />
    <main className={styles.content}>
      <p className={styles.eyebrow}>Patron membership · {PATRON_PERIOD}</p>
      <h1>Our patrons</h1>
      <p className={styles.intro}>Names become available for review only after payment is received. Review and correct paid online signups before approving their names for the thank-you section. Enter check patrons after receiving their payment. Contact details stay private.</p>
      <p className="mb-8"><Link href="/patron" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">View the Patron page ↗</Link></p>
      {!live && <p className={styles.sampleNotice}>Local test roster. These entries are stored on this computer and do not change live membership or patron records.</p>}
      <PatronAdmin />
    </main>
  </div>;
}
