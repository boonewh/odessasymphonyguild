"use client";

import Image from "next/image";
import { useState } from "react";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-[#1a1a2e] to-[#2d3748] text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-lg shadow-xl p-2 hover:scale-105 transition-transform">
              <Image
                src="/images/osg-logo.png"
                alt="Odessa Symphony Guild Logo"
                width={64}
                height={64}
                className="w-full h-full object-contain"
              />
            </div>
            <a href="/" className="hidden md:block text-sm font-light tracking-[0.2em] uppercase hover:text-[#d4af37] transition-colors">
              Odessa <span className="text-[#d4af37]">Symphony Guild</span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="/about"
              className="text-sm tracking-wider hover:text-[#d4af37] transition-colors font-light"
            >
              ABOUT
            </a>
            <a
              href="/belles-beaux"
              className="text-sm tracking-wider hover:text-[#d4af37] transition-colors font-light"
            >
              BELLES & BEAUX
            </a>
            <a
              href="/gala"
              className="text-sm tracking-wider hover:text-[#d4af37] transition-colors font-light"
            >
              GALA
            </a>
            <a
              href="/membership"
              className="text-sm tracking-wider hover:text-[#d4af37] transition-colors font-light"
            >
              MEMBERSHIP
            </a>
            <a
              href="/#contact"
              className="text-sm tracking-wider hover:text-[#d4af37] transition-colors font-light"
            >
              CONTACT
            </a>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-2xl hover:text-[#d4af37] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-4 space-y-2">
            <a
              href="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 border-b border-white/10 hover:text-[#d4af37] transition-colors"
            >
              About
            </a>
            <a
              href="/belles-beaux"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 border-b border-white/10 hover:text-[#d4af37] transition-colors"
            >
              Belles & Beaux
            </a>
            <a
              href="/gala"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 border-b border-white/10 hover:text-[#d4af37] transition-colors"
            >
              Gala
            </a>
            <a
              href="/membership"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 border-b border-white/10 hover:text-[#d4af37] transition-colors"
            >
              Membership
            </a>
            <a
              href="/#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 hover:text-[#d4af37] transition-colors"
            >
              Contact
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}