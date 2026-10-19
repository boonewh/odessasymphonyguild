import Link from "next/link";
import { requireSharedAdmin } from "@/lib/admin/test-page";
import SharedAdminNav from "@/components/admin/SharedAdminNav";
import styles from "@/components/admin/SharedAdmin.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "OSG Administration · Test Site", robots: { index: false, follow: false } };
export default async function AdminHome() {
  await requireSharedAdmin();
  return <div className={styles.page}><SharedAdminNav current="home" /><main className={styles.content}>
    <p className={styles.eyebrow}>Odessa Symphony Guild · Test site</p><h1>What would you like to work on?</h1>
    <p className={styles.intro}>Choose a section below. You can move between Dues and Gala without signing in again.</p>
    <div className={styles.sectionGrid}><div className={styles.cards}>
      <Link href="/admin/dues" className={styles.card}><h2>Dues</h2><p>Belles &amp; Beaux membership and payment status.</p><p className={styles.open}>Open Dues →</p></Link>
      <Link href="/admin/gala" className={styles.card}><h2>Gala</h2><p>Orders, table assignments, gifts, invitations, and the sales ledger.</p><p className={styles.open}>Open Gala →</p></Link>
      <section className={`${styles.card} ${styles.future}`} aria-labelledby="patron-title"><h2 id="patron-title">Patron</h2><p>A place for managing the Guild’s patron program.</p><p className={styles.open}>Coming later</p></section>
    </div></div>
    <p className={styles.help}>This is the test site. Dues uses a sample roster; Gala uses test orders. No real payments are taken here.</p>
  </main></div>;
}
