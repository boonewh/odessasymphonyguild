import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { EVENT } from "@/lib/gala/model";
import styles from "./gala-sales.module.css";

const links = [["tables", "Tables & tickets"], ["gifts", "Celebration gifts"], ["invitations", "Send an invitation"], ["preview/admin", "Preview admin"]];
export default function GalaShell({ current, title, intro, children }: {
  current: string; title: string; intro: string; children: React.ReactNode;
}) {
  const isAdmin = current === "preview/admin";
  const isGift = current === "gifts";
  return <div className={styles.page}>
    <Header theme="gala" />
    <aside className={styles.previewNotice} aria-label="Development preview">
      <strong>Local preview · Sales are closed.</strong> Use fictional details only. Orders stay in this browser. No payments, emails, or QuickBooks entries are created.
    </aside>
    <nav className={styles.nav} aria-label="Gala pages">
      {links.map(([path, label]) => <Link key={path} href={`/gala/${path}`} aria-current={current === path ? "page" : undefined}>{label}</Link>)}
    </nav>
    <div className={isAdmin ? "" : styles.flyerStage}>
      <main className={isAdmin ? styles.container : styles.invitationPaper} data-page={current}>
        {isAdmin ? <header className={styles.hero}>
          <p className={styles.eyebrow}>{EVENT.name}</p><h1>{title}</h1><p className={styles.intro}>{intro}</p>
          <p className={styles.event}>{EVENT.date} <span aria-hidden="true">·</span> {EVENT.venue}</p>
        </header> : <>
          <header className={styles.flyerHero}>
            <Image src="/images/gala-2027-header-art.png" alt="" width={1536} height={1024} priority sizes="(max-width: 700px) 100vw, 1200px" className={styles.heroDecor} />
            <div className={styles.flyerHeading}>
              <p className={styles.guildName}>Odessa Symphony Guild</p>
              <p className={styles.annual}>2027 Annual Gala</p>
              <h1 className={styles.flyerTitle}>
                <span>{isGift ? "Belle & Beaux" : "An Evening of"}</span>
                <em>{isGift ? "Celebration Gifts" : "Timeless Elegance"}</em>
              </h1>
              <div className={styles.flourish} aria-hidden="true"><span />❧<span /></div>
              <p className={styles.pagePurpose}>{isGift ? "A season of service. A moment to celebrate." : title}</p>
              <p className={styles.flyerDate}>{EVENT.date}<span>{EVENT.venue}</span></p>
            </div>
          </header>
          <div className={styles.flyerIntroduction}>
            {current === "tables" && <p className={styles.scriptLine}>An unforgettable evening</p>}
            <p className={styles.intro}>{intro}</p>
            {isGift && <p className={styles.scriptLine}>Don’t forget to celebrate your friends, too!</p>}
            {current === "invitations" && <>
              <a href="#gala-order-details" className={styles.invitationAction}>Submit your invitation information<span aria-hidden="true">↓</span></a>
              <p className={styles.mailPromise}>We will beautifully address and mail<br />your invitations for you.</p>
              <Image src="/images/gala-2027-envelope-art.png" alt="" width={1536} height={1024} sizes="(max-width: 700px) 90vw, 600px" className={styles.envelopeArt} />
            </>}
          </div>
        </>}
        <div className={isAdmin ? "" : styles.flyerContent}>{children}</div>
        {!isAdmin && <p className={styles.flyerSignoff}>Thank you for supporting the arts<br /><span>Odessa Symphony Guild</span></p>}
      </main>
    </div>
    <div className={styles.stripes} aria-hidden="true" />
    <Footer theme="gala" />
  </div>;
}
