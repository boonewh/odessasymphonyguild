"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Image from "next/image";

export default function About() {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] py-24 text-center text-white">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-5xl sm:text-6xl font-light tracking-widest mb-6">
            Our <span className="text-[#d4af37]">Story</span>
          </h1>
          <div className="h-1 w-24 bg-[#d4af37] mx-auto mb-8" />
          <p className="text-xl opacity-90 leading-relaxed font-light tracking-wide">
            Supporting Orchestral Excellence in the Permian Basin Since 1958.
          </p>
        </div>
      </section>

      {/* Who We Are / Mission Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-[#1a1a2e] text-3xl font-light mb-6 tracking-wide italic">
                A Legacy of Volunteerism
              </h2>
              <p className="text-lg leading-relaxed mb-6 font-light">
                The Odessa Symphony Guild is a volunteer-driven, Texas-based 501(c)(3) 
                non-profit organization. We operate without a paid staff, relying 
                entirely on the passion and engagement of community members who believe 
                that classical music is a vital pillar of our region's culture.
              </p>
              <p className="text-lg leading-relaxed font-light">
                Our mission is to promote cultural and musical appreciation through 
                direct financial support and educational outreach, bridging the 
                gap between the community and the symphony orchestra.
              </p>
            </div>
            <div className="bg-[#f8f9fa] p-10 border-l-4 border-[#d4af37] shadow-sm">
              <h3 className="text-[#1a1a2e] text-xl font-semibold mb-4 uppercase tracking-widest">
                Our Core Purpose
              </h3>
              <ul className="space-y-4">
                <li className="flex gap-4">
                  <span className="text-[#d4af37]">✦</span>
                  <p className="text-sm">Fundraising for the West Texas Symphony's professional performances.</p>
                </li>
                <li className="flex gap-4">
                  <span className="text-[#d4af37]">✦</span>
                  <p className="text-sm">Providing educational outreach to students and families across West Texas.</p>
                </li>
                <li className="flex gap-4">
                  <span className="text-[#d4af37]">✦</span>
                  <p className="text-sm">Fostering a lifelong appreciation for orchestral and chorale music.</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Historical Context Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-light text-[#1a1a2e] mb-4">Historical Context</h2>
            <div className="h-0.5 w-16 bg-[#d4af37] mx-auto" />
          </div>
          
          <div className="space-y-12">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="md:w-1/3">
                <span className="text-6xl font-light text-[#d4af37]/30">1957</span>
              </div>
              <div className="md:w-2/3">
                <p className="text-lg leading-relaxed font-light">
                  The movement began when residents organized the <span className="font-semibold">Odessa Symphony Women’s Guild</span>. 
                  This followed the 1947 establishment of the Odessa Little Symphony, marking a 
                  mid-century cultural awakening in West Texas.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 border-t border-gray-200 pt-12">
              <div className="md:w-1/3">
                <span className="text-6xl font-light text-[#d4af37]/30">1969</span>
              </div>
              <div className="md:w-2/3">
                <p className="text-lg leading-relaxed font-light">
                  Originally two separate entities, the Odessa and Midland organizations 
                  formally joined to unify resources and talent. This collaborative 
                  spirit birthed the regional symphony body we support today.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Do - Three Pillars */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-light text-center mb-16 text-[#1a1a2e] tracking-widest uppercase">What We Do</h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#1a1a2e] text-[#d4af37] flex items-center justify-center rounded-full mx-auto mb-6 text-2xl">🎻</div>
              <h3 className="text-xl mb-4 font-medium">Financial Support</h3>
              <p className="text-gray-600 font-light leading-relaxed">
                From performance support to program printing, we raise vital funds that ensure world-class musicians can continue to perform in our region.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#1a1a2e] text-[#d4af37] flex items-center justify-center rounded-full mx-auto mb-6 text-2xl">🤝</div>
              <h3 className="text-xl mb-4 font-medium">Community Advocacy</h3>
              <p className="text-gray-600 font-light leading-relaxed">
                Our members serve as ambassadors, assisting with ticketing, ushering, and spreading awareness of the arts within Odessa and surrounding communities.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#1a1a2e] text-[#d4af37] flex items-center justify-center rounded-full mx-auto mb-6 text-2xl">🎓</div>
              <h3 className="text-xl mb-4 font-medium">Educational Outreach</h3>
              <p className="text-gray-600 font-light leading-relaxed">
                We bridge the gap for students and families, providing opportunities for the next generation to experience the power of live orchestral performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership Section */}
      <section className="py-20 bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative h-[400px] rounded-lg overflow-hidden grayscale hover:grayscale-0 transition-all duration-700">
              <Image 
                src="/images/hero-orchestra.jpg" 
                alt="West Texas Symphony Performance" 
                fill 
                className="object-cover"
              />
            </div>
            <div>
              <h2 className="text-3xl font-light mb-6">Our Relationship with the <span className="text-[#d4af37]">West Texas Symphony</span></h2>
              <p className="opacity-80 leading-relaxed mb-6 font-light">
                The Odessa Symphony Guild is a primary volunteer-fundraising support 
                organization for the <span className="text-[#d4af37] font-medium">West Texas Symphony</span> (formerly the Midland-Odessa 
                Symphony & Chorale). 
              </p>
              <p className="opacity-80 leading-relaxed font-light">
                While we are separate legal entities, we work in lockstep to support 
                an orchestra of over 70 professional musicians and multiple ensembles 
                that perform masterworks and community events throughout the Permian Basin.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Transparency / Non-Profit Info */}
      <section className="py-12 bg-gray-100">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-[0.3em]">
            Odessa Symphony Guild • 501(c)(3) Non-Profit Organization
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}