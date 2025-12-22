"use client";

import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PasswordProtect from "@/components/PasswordProtect";
import { MEMBERSHIP_TIERS, MEMBERSHIP_YEAR } from "@/lib/membership/config";

export default function MembershipPage() {
  return (
    <PasswordProtect>
      <div className="min-h-screen">
        <Header />

      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-orchestra.jpg"
            alt="Become a Member"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a2e]/80" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <h1 className="font-tangerine text-6xl sm:text-7xl md:text-8xl font-bold mb-6 text-white drop-shadow-[4px_4px_8px_rgba(0,0,0,0.8)]">
            Become a Member
          </h1>
          <p className="text-xl sm:text-2xl font-light tracking-wide text-[#d4af37] mb-8">
            Join us in supporting the West Texas Symphony
          </p>
          <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed opacity-95">
            Your membership helps bring world-class music, educational programs, and cultural experiences to our community.
          </p>
        </div>
      </section>

      {/* Membership Year Banner */}
      <section className="bg-gradient-to-r from-[#d4af37] to-[#c19b2e] py-4">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-[#1a1a2e] font-semibold">
            Now Accepting Memberships for {MEMBERSHIP_YEAR.current}
          </p>
        </div>
      </section>

      {/* Membership Tiers Section */}
      <section className="py-20 sm:py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-light mb-6 tracking-wider text-[#1a1a2e]">
              Membership Levels
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose the membership level that's right for you. All members receive exclusive benefits and help sustain our mission.
            </p>
          </div>

          {/* Membership Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {MEMBERSHIP_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`relative bg-white rounded-lg shadow-xl overflow-hidden transition-transform duration-300 hover:scale-105 flex flex-col ${
                  tier.popular ? 'ring-4 ring-[#d4af37]' : ''
                }`}
              >
                {tier.popular && (
                  <div className="absolute top-0 right-0 bg-[#d4af37] text-[#1a1a2e] px-4 py-1 text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <div className="p-8 flex flex-col flex-grow">
                  <h3 className="text-2xl font-light mb-2 text-[#1a1a2e] tracking-wide">
                    {tier.name}
                  </h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-[#d4af37]">${tier.price}</span>
                    <span className="text-gray-600 text-sm">/year</span>
                  </div>
                  <p className="text-gray-700 text-sm mb-6 leading-relaxed">
                    {tier.description}
                  </p>

                  <div className="mb-8 flex-grow">
                    <h4 className="font-semibold text-[#1a1a2e] mb-3 text-sm uppercase tracking-wider">
                      Benefits Include:
                    </h4>
                    <ul className="space-y-2">
                      {tier.benefits.map((benefit, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-[#d4af37] mt-1">✓</span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    href={`/membership/join?tier=${tier.id}`}
                    className="block w-full bg-[#1a1a2e] text-white text-center py-3 rounded font-semibold tracking-wider hover:bg-[#2d3748] transition-colors mt-auto"
                  >
                    Select {tier.name}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Join Section */}
      <section className="py-20 sm:py-24 lg:py-32 bg-gradient-to-br from-[#2d3748] to-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-light mb-6 tracking-wider">
              Why Become a Member?
            </h2>
            <p className="text-xl text-[#d4af37] max-w-2xl mx-auto">
              Your membership makes a meaningful difference in our community
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="text-5xl mb-4">🎵</div>
              <h3 className="text-2xl font-light mb-4 text-[#d4af37]">Support the Arts</h3>
              <p className="text-gray-300 leading-relaxed">
                Your membership directly supports the West Texas Symphony, funding concerts, educational programs, and community outreach initiatives.
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-4">🤝</div>
              <h3 className="text-2xl font-light mb-4 text-[#d4af37]">Connect & Engage</h3>
              <p className="text-gray-300 leading-relaxed">
                Join a community of music lovers, attend exclusive events, and connect with fellow supporters who share your passion for the arts.
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-4">🎓</div>
              <h3 className="text-2xl font-light mb-4 text-[#d4af37]">Inspire Future Generations</h3>
              <p className="text-gray-300 leading-relaxed">
                Help ensure that young people in West Texas have access to quality music education and the transformative power of live performances.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 sm:py-24 lg:py-32 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl sm:text-5xl font-light text-center mb-16 tracking-wider text-[#1a1a2e]">
            Frequently Asked Questions
          </h2>

          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold mb-3 text-[#1a1a2e]">
                What is the membership period?
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Memberships run from July 1 through June 30 each year, aligning with our fiscal year. Your membership for {MEMBERSHIP_YEAR.current} is active through {MEMBERSHIP_YEAR.endDate}.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3 text-[#1a1a2e]">
                Are membership dues tax-deductible?
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Yes! The Odessa Symphony Guild is a 501(c)(3) nonprofit organization. Your membership contribution is tax-deductible to the extent allowed by law. You will receive a receipt for your records.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3 text-[#1a1a2e]">
                Can I upgrade my membership level during the year?
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Absolutely! You can upgrade your membership at any time. Simply contact us, and we'll help you upgrade and credit your existing payment toward the higher tier.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3 text-[#1a1a2e]">
                How will I receive my membership benefits?
              </h3>
              <p className="text-gray-700 leading-relaxed">
                After joining, you'll receive a welcome email with details about your membership benefits. Your membership card will be mailed to you, and you'll be added to our newsletter and event invitation lists.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3 text-[#1a1a2e]">
                What if I have questions?
              </h3>
              <p className="text-gray-700 leading-relaxed">
                We're here to help! Please reach out through our{' '}
                <a href="https://www.facebook.com/odessasymphonyguild/" target="_blank" rel="noopener noreferrer" className="text-[#d4af37] hover:text-[#c19b2e] underline">
                  Facebook page
                </a>{' '}
                or contact us at membership@odessasymphonyguild.org (example email).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-[#d4af37] to-[#c19b2e]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl sm:text-5xl font-light mb-6 text-[#1a1a2e]">
            Ready to Join?
          </h2>
          <p className="text-lg text-[#1a1a2e] mb-8 opacity-90">
            Become part of our community and help support the arts in West Texas
          </p>
          <Link
            href="/membership/join"
            className="inline-block bg-[#1a1a2e] text-white px-12 py-4 rounded font-semibold tracking-wider hover:bg-[#2d3748] transform hover:-translate-y-1 transition-all shadow-lg hover:shadow-xl text-lg"
          >
            JOIN NOW
          </Link>
        </div>
      </section>

        <Footer />
      </div>
    </PasswordProtect>
  );
}
