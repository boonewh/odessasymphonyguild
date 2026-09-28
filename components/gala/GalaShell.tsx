import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { EVENT } from "@/lib/gala/model";
import styles from "./gala-sales.module.css";

const links = [["tables", "Tables & tickets"], ["gifts", "Celebration gifts"], ["invitations", "Send an invitation"], ["preview/admin", "Preview admin"]];
export default function GalaShell({ current, title, intro, children }: {
  current: string; title: string; intro: string; children: React.ReactNode;
}) {
  return <div className={styles.page}>
    <Header theme="gala" />
    <aside className={styles.previewNotice} aria-label="Development preview">
      <strong>Local preview · Sales are closed.</strong> Use fictional details only. Orders stay in this browser. No payments, emails, or QuickBooks entries are created.
    </aside>
    <nav className={styles.nav} aria-label="Gala pages">
      {links.map(([path, label]) => <Link key={path} href={`/gala/${path}`} aria-current={current === path ? "page" : undefined}>{label}</Link>)}
    </nav>
    <div className={styles.stripes} aria-hidden="true" />
    <main className={styles.container}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{EVENT.name}</p>
        <h1>{title}</h1>
        <p className={styles.intro}>{intro}</p>
        <p className={styles.event}>{EVENT.date} <span aria-hidden="true">·</span> {EVENT.venue}</p>
      </header>
      {children}
    </main>
    <div className={styles.stripes} aria-hidden="true" />
    <Footer theme="gala" />
  </div>;
}
