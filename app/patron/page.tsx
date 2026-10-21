import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PATRONS_2025 } from "@/lib/patrons";
import PatronSignup from "@/components/patron/PatronSignup";
import { patronEnabled } from "@/lib/patron/config";
import { getPatronStore } from "@/lib/patron/store";
import { PATRON_PERIOD } from "@/lib/patron/model";
import { liveSiteEnabled } from "@/lib/gala/live-release";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Patrons | Odessa Symphony Guild",
  description:
    "Celebrate the patrons who help the Odessa Symphony Guild support music, education, and the West Texas Symphony.",
};

export default async function PatronPage() {
  const enabled = patronEnabled();
  let names: string[] = [], unavailable = false;
  if (enabled) {
    try { names = await (await getPatronStore()).names(PATRON_PERIOD); }
    catch { unavailable = true; }
  }
  return (
    <div className="isolate min-h-dvh bg-white text-[#1a1a2e]">
      <Header />
      <main>
        <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] py-14 text-white sm:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="mb-6 text-lg text-[#d4af37]">Patrons of the Odessa Symphony Guild</p>
              <h1 className="max-w-[20ch] text-balance text-5xl font-normal tracking-tight sm:text-6xl">
                Keep <span className="text-[#d4af37]">music</span> at the heart of West Texas
              </h1>
              <div className="my-8 h-0.5 w-20 bg-[#d4af37]" aria-hidden="true" />
              <p className="max-w-[48ch] text-pretty text-lg leading-8 text-white/85">
                A shared love of music. A generous community. As a patron, you
                help the Guild support the West Texas Symphony and bring music
                into more lives.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4 text-base">
                <a
                  href="#become-a-patron"
                  className="inline-flex min-h-12 items-center justify-center rounded bg-[#d4af37] px-6 py-3 font-semibold text-[#1a1a2e] hover:bg-[#c19b2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d4af37]"
                >
                  Become a patron
                </a>
                <a href="#thank-you" className="inline-flex min-h-12 items-center underline decoration-white/40 underline-offset-8 hover:decoration-[#d4af37] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d4af37]">
                  Meet our patrons <span aria-hidden="true" className="pl-2">↓</span>
                </a>
              </div>
            </div>
            <figure>
              <Image
                src="/images/patron-support.jpg"
                alt="Guild representatives presenting a donation check to the West Texas Symphony"
                width={1104}
                height={1200}
                sizes="(min-width: 1280px) 584px, (min-width: 1024px) calc(50vw - 56px), calc(100vw - 48px)"
                className="aspect-[6/5] w-full rounded-[min(1vw,8px)] object-cover object-top"
                preload
              />
              <figcaption className="mt-4 text-base italic text-white/70 sm:text-sm">
                Our community’s generosity, put into action.
              </figcaption>
            </figure>
          </div>
        </section>

        <section aria-labelledby="support-heading" className="border-b border-[#1a1a2e]/10 py-14 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:px-8">
            <h2 id="support-heading" className="max-w-[24ch] text-balance text-3xl font-normal tracking-tight sm:text-4xl">
              Your support is part of every performance
            </h2>
            <div className="space-y-5 text-lg leading-8 text-gray-600">
              <p className="max-w-[48ch] text-pretty">
                Patrons help sustain the Guild’s support of concert productions,
                educational programs, and the music that brings our community together.
              </p>
              <p className="max-w-[48ch] text-pretty">
                It’s a meaningful way to stay connected to the arts and continue
                a tradition of generosity that has shaped the Guild since 1958.
              </p>
            </div>
          </div>
        </section>

        <section id="thank-you" aria-labelledby="thank-you-heading" className="scroll-mt-24 bg-[#faf8f3] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center">
              <p className="mb-4 text-lg text-[#806515]">With heartfelt gratitude</p>
              <h2 id="thank-you-heading" className="text-balance text-4xl font-normal tracking-tight sm:text-5xl">
                Thank you, patrons
              </h2>
              <p className="mx-auto mt-6 max-w-[48ch] text-pretty text-lg leading-8 text-gray-600">
                Your generosity helps keep music a vibrant part of life in West Texas.
              </p>
            </div>

            <div className="mt-12 border-y border-[#d4af37]/40 py-10 sm:py-12">
              <h3 className="mb-8 text-center text-xl font-normal">{PATRON_PERIOD} Guild Patrons</h3>
              {unavailable ? <p role="status" className="text-center text-lg text-gray-600">Our patron list is temporarily unavailable. Please check back soon.</p>
                : names.length > 0 ? <ul role="list" className={`grid gap-x-6 gap-y-5 text-center text-lg text-gray-700 sm:gap-x-12 ${names.length === 1 ? "grid-cols-1" : names.length === 2 ? "grid-cols-1 min-[360px]:grid-cols-2" : names.length === 3 ? "grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3" : "grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}>
                  {names.map(name => <li key={name}>{name}</li>)}
                </ul> : <p className="text-center text-lg text-gray-600">A new year of generosity is beginning. We look forward to thanking our patrons here.</p>}
            </div>
            <details className="mt-8">
              <summary className="mx-auto w-fit cursor-pointer py-3 text-lg underline decoration-[#d4af37] underline-offset-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#806515]">Our 2025 Guild Patrons</summary>
              <ul role="list" className="mt-8 grid grid-cols-1 gap-x-6 gap-y-5 text-center text-lg text-gray-700 min-[360px]:grid-cols-2 sm:gap-x-12 md:grid-cols-3 lg:grid-cols-4">
                {PATRONS_2025.map(name => <li key={name}>{name}</li>)}
              </ul>
            </details>
            <p className="mt-8 text-center text-base italic text-gray-600">
              For the music. For our community. For generations to come.
            </p>
          </div>
        </section>

        <section id="become-a-patron" aria-labelledby="join-heading" className="scroll-mt-24 py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="mb-4 text-lg text-[#806515]">Patron membership · {PATRON_PERIOD}</p>
              <h2 id="join-heading" className="max-w-[24ch] text-balance text-3xl font-normal tracking-tight sm:text-4xl">
                There’s a place for you here
              </h2>
              <p className="mt-6 max-w-[48ch] text-pretty text-lg leading-8 text-gray-600">
                Join a community that believes in the power of music. Patron
                membership offers the benefits of Guild membership, with the
                exception of voting and holding office.
              </p>
              <p className="mt-8 text-4xl tabular-nums">$100</p>
              <p className="mt-3 text-lg text-gray-600">Annual patron dues</p>
              <p className="mt-6 max-w-[48ch] text-pretty text-lg leading-8 text-gray-600">
                This signup form does not collect payment. To arrange your dues
                or contribute by check, <Link href="/#contact" className="underline decoration-[#806515] underline-offset-4">contact the Guild</Link>.
              </p>
            </div>
            <div className="border-l-2 border-[#d4af37] pl-6 sm:pl-8">
              {enabled && !liveSiteEnabled(process.env) && <p className="mb-6 bg-[#faf8f3] p-4 text-base text-gray-700">Local preview: use fictional contact details. These signups do not appear on the live website.</p>}
              {enabled ? <PatronSignup /> : <p className="text-lg leading-8 text-gray-600">Online patron signup is not open yet. Please contact the Guild to become a patron.</p>}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
