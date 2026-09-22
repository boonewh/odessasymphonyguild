"use client";

import Image from "next/image";
import { useState } from "react";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";

export default function Header({ theme = "default" }: { theme?: "default" | "gala" }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className={`sticky top-0 z-50 text-white shadow-lg ${theme === "gala" ? "bg-[#171918] [--header-accent:#82cfcc] [--header-accent-hover:#a5dfdc] [--header-border:#82cfccb3]" : "bg-gradient-to-r from-[#1a1a2e] to-[#2d3748] [--header-accent:#d4af37] [--header-accent-hover:#c19b2e] [--header-border:#d4af37b3]"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <a href="/" className="w-16 h-16 bg-white rounded-lg shadow-xl p-2 hover:scale-105 transition-transform">
              <Image
                src="/images/osg-logo.png"
                alt="Odessa Symphony Guild Logo"
                width={64}
                height={64}
                className="w-full h-full object-contain"
              />
            </a>
            <a href="/" className="hidden lg:block text-sm font-light tracking-[0.2em] uppercase hover:text-[var(--header-accent)] transition-colors">
              Odessa <span className="text-[var(--header-accent)]">Symphony Guild</span>
            </a>
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
            <a
              href="/gala"
              className="text-sm tracking-wider hover:text-[var(--header-accent)] transition-colors font-light"
            >
              GALA
            </a>
            <a
              href="/#contact"
              className="text-sm tracking-wider hover:text-[var(--header-accent)] transition-colors font-light"
            >
              CONTACT
            </a>
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
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
          <nav id="mobile-navigation" className="lg:hidden pb-4 space-y-2">
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
            <a
              href="/#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 border-b border-white/10 hover:text-[var(--header-accent)] transition-colors"
            >
              Contact
            </a>
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
