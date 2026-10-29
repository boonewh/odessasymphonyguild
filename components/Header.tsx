"use client";
import Link from "next/link";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";

// Public Patron navigation restored for the October 28 launch.
const SHOW_PATRONS_NAV = true;
const GALA_LINKS = [
  { href: "/gala/tables", label: "Tables & tickets" },
  { href: "/gala/gifts", label: "Celebration gifts" },
  { href: "/gala/invitations", label: "Request invitations" },
];

export default function Header({ theme = "default" }: { theme?: "default" | "gala" }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [galaMenuOpen, setGalaMenuOpen] = useState(false);
  const galaMenu = useRef<HTMLDivElement>(null);
  const galaToggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!galaMenuOpen) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !galaMenu.current?.contains(event.target)) setGalaMenuOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [galaMenuOpen]);

  return (
    <header className={`sticky top-0 z-50 text-white shadow-lg ${theme === "gala" ? "bg-[#171918] [--header-accent:#82cfcc] [--header-accent-hover:#a5dfdc] [--header-border:#82cfccb3]" : "bg-gradient-to-r from-[#1a1a2e] to-[#2d3748] [--header-accent:#d4af37] [--header-accent-hover:#c19b2e] [--header-border:#d4af37b3]"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <Link href="/" className="w-16 h-16 bg-white rounded-lg shadow-xl p-2 hover:scale-105 transition-transform">
              <Image
                src="/images/osg-logo.png"
                alt="Odessa Symphony Guild Logo"
                width={64}
                height={64}
                className="w-full h-full object-contain"
              />
            </Link>
            <Link href="/" className="hidden xl:block text-sm font-light tracking-[0.2em] uppercase hover:text-[var(--header-accent)] transition-colors">
              Odessa <span className="text-[var(--header-accent)]">Symphony Guild</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <a
              href="/about"
              className="text-sm tracking-wider hover:text-[var(--header-accent)] transition-colors font-light"
            >
              ABOUT
            </a>
            <a
              href="/belles-beaux"
              className="text-sm tracking-wider hover:text-[var(--header-accent)] transition-colors font-light"
            >
              BELLES & BEAUX
            </a>
            <div
              ref={galaMenu}
              className="relative text-sm"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setGalaMenuOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setGalaMenuOpen(false);
                  galaToggle.current?.focus();
                }
              }}
            >
              <button
                ref={galaToggle}
                type="button"
                onClick={() => setGalaMenuOpen(!galaMenuOpen)}
                aria-expanded={galaMenuOpen}
                aria-controls="gala-navigation"
                className="flex min-h-12 items-center gap-2 tracking-wider font-light hover:text-[var(--header-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--header-accent)]"
              >
                GALA <span aria-hidden="true">▾</span>
              </button>
              {galaMenuOpen && (
                <div id="gala-navigation" className="absolute left-0 top-full w-60 rounded-lg bg-white p-2 text-[#171918] shadow-xl ring-1 ring-black/10">
                  {[{ href: "/gala", label: "Gala overview" }, ...GALA_LINKS].map(({ href, label }) => (
                    <a key={href} href={href} onClick={() => setGalaMenuOpen(false)} className="flex min-h-12 items-center rounded px-3 hover:bg-[#edf5f4] focus-visible:bg-[#edf5f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#286a68]">{label}</a>
                  ))}
                </div>
              )}
            </div>
            {SHOW_PATRONS_NAV && <a
              href="/patron"
              className="text-sm tracking-wider hover:text-[var(--header-accent)] transition-colors font-light"
            >
              PATRONS
            </a>}
            <Link
              href="/#contact"
              className="text-sm tracking-wider hover:text-[var(--header-accent)] transition-colors font-light"
            >
              CONTACT
            </Link>
          </nav>

          {/* Join button (desktop) + mobile menu button */}
          <div className="flex items-center gap-3">
            <a
              href="/belles-beaux/join"
              className={BELLES_BEAUX_CONFIG.registrationOpen
                ? "rounded-lg bg-[var(--header-accent)] px-4 py-2 text-sm font-semibold text-[#1a1a2e] hover:bg-[var(--header-accent-hover)]"
                : "rounded-lg border border-[var(--header-border)] px-3 py-2 text-sm font-semibold text-[var(--header-accent)] hover:border-[var(--header-accent)]"}
            >
              {BELLES_BEAUX_CONFIG.registrationOpen ? "JOIN" : "PROGRAM INFO"}
            </a>
            <button
              onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setGalaMenuOpen(false); }}
              className="lg:hidden p-2 text-2xl hover:text-[var(--header-accent)] transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav id="mobile-navigation" className="lg:hidden max-h-[calc(100dvh-5rem)] overflow-y-auto pb-4 space-y-2">
            <a
              href="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 border-b border-white/10 hover:text-[var(--header-accent)] transition-colors"
            >
              About
            </a>
            <a
              href="/belles-beaux"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 border-b border-white/10 hover:text-[var(--header-accent)] transition-colors"
            >
              Belles & Beaux
            </a>
            <a
              href="/gala"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 border-b border-white/10 hover:text-[var(--header-accent)] transition-colors"
            >
              Gala
            </a>
            <div className="border-l border-[var(--header-border)] pl-4 text-base">
              {GALA_LINKS.map(({ href, label }) => (
                <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="flex min-h-12 items-center py-2 hover:text-[var(--header-accent)]">{label}</a>
              ))}
            </div>
            {SHOW_PATRONS_NAV && <a
              href="/patron"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 border-b border-white/10 hover:text-[var(--header-accent)] transition-colors"
            >
              Patrons
            </a>}
            <Link
              href="/#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 border-b border-white/10 hover:text-[var(--header-accent)] transition-colors"
            >
              Contact
            </Link>
            <a
              href="/belles-beaux/join"
              onClick={() => setMobileMenuOpen(false)}
              className={BELLES_BEAUX_CONFIG.registrationOpen
                ? "mt-2 rounded-lg bg-[var(--header-accent)] px-4 py-2.5 text-center text-sm font-semibold text-[#1a1a2e] hover:bg-[var(--header-accent-hover)]"
                : "mt-2 rounded-lg border border-[var(--header-border)] px-3 py-2.5 text-center text-sm font-semibold text-[var(--header-accent)] hover:border-[var(--header-accent)]"}
            >
              {BELLES_BEAUX_CONFIG.registrationOpen ? "Join" : "Program Info"}
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
