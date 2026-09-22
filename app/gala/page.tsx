import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import styles from "./gala.module.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://odessasymphonyguild.org"),
  title: "Breakfast at Tiffany’s | 2027 Symphony Ball | Odessa Symphony Guild",
  description: "Join the Odessa Symphony Guild for the 2027 Symphony Ball & Presentation, inspired by Breakfast at Tiffany’s. February 27, 2027 at La Hacienda.",
};

function Arrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.arrow} fill="none" stroke="currentColor">
      <path d="M4 12h15m-6-6 6 6-6 6" strokeWidth="1.5" />
    </svg>
  );
}

export default function GalaPage() {
  return (
    <div className={`${styles.page} isolate antialiased`}>
      <Header theme="gala" />
      <main id="main-content">
        <section className={styles.hero} aria-labelledby="gala-title">
          <div className={styles.stripes} aria-hidden="true" />
          <div className={styles.heroInner}>
            <Image src="/images/symphony-ball-2027-hero.png" alt="" fill priority sizes="100vw" className={styles.heroArt} />
            <div className={styles.invitationFrame} aria-hidden="true" />
            <div className={styles.heroCopy}>
              <p className={styles.presenter}>Odessa Symphony Guild presents</p>
              <p className={styles.edition}>The 2027 Symphony Ball &amp; Presentation</p>
              <h1 id="gala-title" className={styles.title}>
                <span className={styles.titleLead}>An Evening of</span>{" "}
                <span className={styles.titleSecondLine}>Timeless Elegance</span>
              </h1>
              <div className={styles.ornament} aria-hidden="true"><span />◆<span /></div>
              <p className={styles.heroDate}><time dateTime="2027-02-27">February 27, 2027</time></p>
              <p className={styles.heroVenue}>La Hacienda</p>
              <div className={styles.heroActions}>
                <a href="#the-evening" className={styles.primaryLink}>You’re invited <Arrow /></a>
                <a href="/symphony-ball-2027.ics" download className={styles.textLink}>Add to calendar</a>
              </div>
            </div>
          </div>
          <div className={styles.heroRibbon}>
            <p>An evening inspired by the timeless style of the 1961 film.</p>
          </div>
        </section>

        <section id="the-evening" className={styles.details} aria-labelledby="details-title">
          <div className={styles.container}>
            <div>
              <p className={styles.eyebrow}>An invitation to celebrate</p>
              <h2 id="details-title">Mark your calendar.<br />Make a memory.</h2>
            </div>
            <dl className={styles.eventDetails}>
              <div>
                <dt>The date</dt>
                <dd><time dateTime="2027-02-27">Saturday, February 27</time><span className={styles.detailNote}>2027</span></dd>
              </div>
              <div>
                <dt>The setting</dt>
                <dd>La Hacienda<span className={styles.detailNote}>An evening with the Odessa Symphony Guild</span></dd>
              </div>
              <div>
                <dt>The occasion</dt>
                <dd>Symphony Ball<span className={styles.detailNote}>&amp; Belles and Beaux Presentation</span></dd>
              </div>
            </dl>
            <p className={styles.detailsNote}>Event time, ticket information, and additional details will be announced here.</p>
          </div>
        </section>

        <section className={styles.story} aria-labelledby="story-title">
          <div className={`${styles.container} ${styles.split}`}>
            <div className={styles.storyCopy}>
              <p className={styles.eyebrow}>Timeless style. Meaningful tradition.</p>
              <h2 id="story-title">An unforgettable evening.<br /><em>A brighter tomorrow.</em></h2>
              <p>Classic black and white. A touch of Tiffany blue. This year, the Symphony Ball takes its inspiration from <cite>Breakfast at Tiffany’s</cite>, the beloved 1961 film.</p>
              <p>Behind the glamour is a tradition close to our hearts: celebrating the young people, families, and Guild members whose generosity and service help the arts thrive in West Texas.</p>
              <p>Join us as we bring the 2026–2027 Belles and Beaux season to a beautiful close and celebrate all we can accomplish together.</p>
              <div className={styles.storyLink}>
                <Link href="/belles-beaux" className={styles.textLink}>Discover Belles &amp; Beaux <Arrow /></Link>
              </div>
            </div>
            <figure className={styles.flyer}>
              <a href="/images/symphony-ball-2027-flyer.jpeg" target="_blank" rel="noopener noreferrer" aria-label="View the 2027 Symphony Ball invitation, opens in a new tab">
                <Image src="/images/symphony-ball-2027-flyer.jpeg" alt="The 2027 Symphony Ball invitation, with a black satin bow, vintage fashion illustration, Tiffany blue gifts, and pearls." width={1200} height={1800} sizes="(max-width: 767px) 90vw, 420px" />
              </a>
              <figcaption>The invitation to a very special evening.</figcaption>
            </figure>
          </div>
        </section>

        <section className={styles.presentation} aria-labelledby="presentation-title">
          <div className={`${styles.container} ${styles.split}`}>
            <div>
              <p className={styles.eyebrow}>The heart of the ball</p>
              <h2 id="presentation-title">A moment to shine.<br />A season of service.</h2>
            </div>
            <div className={styles.presentationCopy}>
              <p>The Belles and Beaux presentation honors a season of leadership, friendship, and giving back to our community.</p>
              <p>We celebrate our participating students and give special recognition to our seniors for their years of dedication to the Guild and the West Texas Symphony.</p>
              <p className={styles.familyNote}>For our families: presentation, practice, and volunteer information will be shared as plans are finalized.</p>
            </div>
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          <div className={styles.container}>
            <p className={styles.eyebrow}>Save the date</p>
            <h2 id="closing-title">Some evenings become traditions.</h2>
            <p className={styles.closingScript}>Be part of ours.</p>
            <p className={styles.closingDate}>February 27, 2027 <span aria-hidden="true">·</span> La Hacienda</p>
            <div className={styles.closingActions}>
              <a href="https://www.facebook.com/odessasymphonyguild/" target="_blank" rel="noopener noreferrer" className={styles.textLink}>Follow the Guild for updates <Arrow /></a>
              <a href="/images/symphony-ball-2027-flyer.jpeg" download className={styles.textLink}>Download the invitation</a>
            </div>
          </div>
        </section>
        <div className={styles.stripes} aria-hidden="true" />
      </main>
      <Footer theme="gala" />
    </div>
  );
}
