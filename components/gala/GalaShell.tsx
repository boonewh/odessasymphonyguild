import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { EVENT } from "@/lib/gala/model";
import styles from "./gala-sales.module.css";

const links = [["tables", "Tables & tickets"], ["gifts", "Celebration gifts"], ["invitations", "Send an invitation"], ["preview/admin", "Preview admin"]];
export default function GalaShell({ current, title, intro, children, clientReview = false, sandbox = false }: {
  current: string; title: string; intro: string; children: React.ReactNode; clientReview?: boolean; sandbox?: boolean;
}) {
  const isAdmin = current === "preview/admin";
  const isGift = current === "gifts";
  return <div className={styles.page}>
    {clientReview ? <header className={styles.reviewHeader}><Image src="/images/osg-logo.png" alt="Odessa Symphony Guild" width={64} height={64} /><span>Odessa Symphony Guild</span></header> : <Header theme="gala" />}
    <aside className={styles.previewNotice} aria-label="Development preview">
      {clientReview ? <><strong>Client preview · Sales are not open.</strong> Explore the designs and pricing. Personal information and submissions are disabled.</> : sandbox && current === "invitations" ? <><strong>Local sandbox · Invitation testing.</strong> Use fictional names and addresses. Requests are saved in the development database; no invitations or emails are sent.</> : sandbox ? <><strong>Local sandbox · No real payments.</strong> Use fictional details and Stripe test cards. Orders are saved in the separate development database. Sales are not open to the public.</> : <><strong>Local preview · Sales are closed.</strong> Use fictional details only. Orders stay in this browser. No payments, emails, or QuickBooks entries are created.</>}
    </aside>
    <nav className={styles.nav} aria-label="Gala pages">
      {links.filter(([path]) => !clientReview || path !== "preview/admin").map(([path, label]) => <Link key={path} href={`/gala/${path}`} aria-current={current === path ? "page" : undefined}>{label}</Link>)}
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
              <a href="#gala-order-details" className={styles.invitationAction}>
                <svg className={styles.invitationTicket} viewBox="0 0 500 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                  <defs><linearGradient id="invitation-ticket-teal" x2="1" y2="1"><stop stopColor="#21868d" /><stop offset="1" stopColor="#37a7ac" /></linearGradient></defs>
                  <path d="M18 2H482Q482 18 498 18V142Q482 142 482 158H18Q18 142 2 142V18Q18 18 18 2Z" fill="#fffaf0" stroke="#b88b36" strokeWidth="1.5" />
                  <path d="M23 7H477Q479 23 493 23V137Q479 137 477 153H23Q21 137 7 137V23Q21 23 23 7Z" fill="url(#invitation-ticket-teal)" stroke="#b88b36" strokeWidth="1" />
                </svg>
                <span className={styles.invitationActionCopy}><strong>Click here</strong><span>to submit your</span><span>invitation information</span></span>
              </a>
              <p className={styles.mailPromise}>We will beautifully address and mail<br />your invitations for you.</p>
              <Image src="/images/gala-2027-envelope-invited-cursive.png" alt="" width={1536} height={1024} sizes="(max-width: 700px) 90vw, 600px" className={styles.envelopeArt} />
            </>}
          </div>
        </>}
        <div className={isAdmin ? "" : styles.flyerContent}>{children}</div>
        {!isAdmin && <p className={styles.flyerSignoff}>Thank you for supporting the arts<br /><span>Odessa Symphony Guild</span></p>}
      </main>
    </div>
    <div className={styles.stripes} aria-hidden="true" />
    {clientReview ? <footer className={styles.reviewFooter}>Odessa Symphony Guild · Gala 2027 client review</footer> : <Footer theme="gala" />}
  </div>;
}
