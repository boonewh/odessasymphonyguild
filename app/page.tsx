import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-orchestra.jpg"
            alt="Orchestra Performance"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a2e]/80" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <h1 className="font-tangerine text-7xl sm:text-8xl md:text-9xl font-bold mb-6 text-white drop-shadow-[4px_4px_8px_rgba(0,0,0,0.8)]">
            Odessa Symphony Guild
          </h1>
          <p className="text-xl sm:text-2xl md:text-3xl font-light tracking-[0.15em] text-[#d4af37] mb-8">
            Enriching West Texas Through Music Since 1958
          </p>
          <p className="text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed opacity-95">
            For over six decades, we have supported the West Texas Symphony,
            bringing world-class music, culture, and educational opportunities to
            our community through dedicated volunteer service and financial
            support.
          </p>
          <a
            href="/belles-beaux/join"
            className="inline-block bg-[#d4af37] text-[#1a1a2e] px-8 sm:px-10 py-4 rounded font-semibold tracking-wider hover:bg-[#c19b2e] transform hover:-translate-y-1 transition-all shadow-lg hover:shadow-xl text-sm sm:text-base"
          >
            {BELLES_BEAUX_CONFIG.registrationOpen ? "JOIN OUR MISSION" : "BELLES & BEAUX INFORMATION"}
          </a>
        </div>
      </section>

      {/* About Section with Our Mission */}
      <section id="about" className="py-20 sm:py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl sm:text-5xl font-light text-center mb-16 tracking-wider text-[#1a1a2e]">
            Our Heritage
          </h2>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Text Content */}
            <div className="space-y-6 text-lg leading-relaxed">
              <p>
                The Odessa Symphony Guild was founded in 1958 by a visionary
                group of women determined to bring fine arts and culture to West
                Texas. What began as a passionate effort to support local
                musicians has grown into a thriving non-profit organization that
                continues to honor the spirit of its founding members.
              </p>

              <p>
                Through more than sixty-five years of service, the Guild has
                raised thousands of dollars and contributed countless volunteer
                hours to support the West Texas Symphony. This partnership enables
                the symphony to provide our community with exceptional educational
                programs and world-class concerts that enrich the cultural fabric
                of West Texas.
              </p>

              <div className="pt-4">
                <div className="inline-flex items-center gap-3 text-[#d4af37] font-semibold">
                  <span className="text-6xl font-light">65+</span>
                  <span className="text-base uppercase tracking-wider text-[#1a1a2e]">
                    Years of<br />Service
                  </span>
                </div>
              </div>
            </div>

            {/* Our Mission Box */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] text-white p-8 sm:p-10 rounded-lg shadow-2xl">
              <h3 className="text-3xl sm:text-4xl font-light mb-6 text-[#d4af37] tracking-wider">
                Our Mission
              </h3>
              <p className="leading-relaxed text-base sm:text-lg mb-6">
                To provide unwavering support to the West Texas Symphony through
                volunteer service and financial contributions, ensuring that
                exceptional music education and performances remain accessible to
                current and future generations of West Texans.
              </p>
              <p className="italic text-[#d4af37] leading-relaxed">
                We believe in the transformative power of music and its ability
                to unite and inspire our community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How We Serve Section */}
      <section id="programs" className="py-20 sm:py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl sm:text-5xl font-light text-center mb-6 tracking-wider text-[#1a1a2e]">
            How We Serve
          </h2>
          <p className="text-center text-lg text-gray-600 max-w-2xl mx-auto mb-20">
            Supporting the symphony through dedicated volunteer programs
          </p>

          <div className="space-y-20">
            {/* Active Members - Image Left */}
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="relative h-80 lg:h-96 rounded-lg overflow-hidden shadow-xl group">
                <Image
                  src="/images/active-members.jpg"
                  alt="Active Guild members volunteering at symphony event"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>

              <div className="lg:pl-8">
                <div className="inline-block mb-4">
                  <div className="h-1 w-16 bg-[#d4af37]" />
                </div>
                <h3 className="text-3xl sm:text-4xl font-light mb-6 text-[#1a1a2e] tracking-wide">
                  Active Members
                </h3>
                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                  Our active members form the backbone of the Guild, volunteering
                  their time to promote concerts, usher performances, host
                  receptions, and serve musicians.
                </p>
                <p className="text-base text-gray-600 leading-relaxed">
                  They ensure every symphony event runs smoothly and every guest
                  feels welcomed, embodying our commitment to excellence in service
                  and hospitality.
                </p>
              </div>
            </div>

            {/* Patron Support - Image Right */}
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="lg:pr-8 order-2 lg:order-1">
                <div className="inline-block mb-4">
                  <div className="h-1 w-16 bg-[#d4af37]" />
                </div>
                <h3 className="text-3xl sm:text-4xl font-light mb-6 text-[#1a1a2e] tracking-wide">
                  Patron Support
                </h3>
                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                  Patrons provide vital financial support to the Guild and the West
                  Texas Symphony. Their generous contributions help fund educational
                  programs, concert productions, and operational needs.
                </p>
                <p className="text-base text-gray-600 leading-relaxed">
                  Through their philanthropy, patrons make our mission possible,
                  ensuring that world-class musical experiences remain accessible to
                  our community.
                </p>
              </div>

              <div className="relative h-80 lg:h-96 rounded-lg overflow-hidden shadow-xl group order-1 lg:order-2">
                <Image
                  src="/images/patron-support.jpg"
                  alt="Patron supporters at Guild event"
                  fill
                  className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </div>

            {/* 2025 Patrons List */}
            <div className="mt-16 pt-16 border-t border-gray-200">
              <div className="text-center mb-10">
                <h4 className="text-2xl sm:text-3xl font-light text-[#1a1a2e] tracking-wide mb-2">
                  2025 Guild Patrons
                </h4>
                <div className="h-1 w-20 bg-[#d4af37] mx-auto" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 max-w-4xl mx-auto text-center">
                {[
                  "Dana Ashton",
                  "Lois Ballard",
                  "Erin Berridge",
                  "Kathy Bobbitt",
                  "Susie Davis",
                  "Cary Dobbs",
                  "Vanessa Dunn",
                  "Sondra Eoff",
                  "Rhonda Gilliam",
                  "Amanda George",
                  "Jacqui Gore",
                  "Carla Haston",
                  "Carolina Keith",
                  "Stephanie Latimer",
                  "JoLynn Logan",
                  "Anne Mackey",
                  "Carla Pradon",
                  "Libby Sibert",
                  "Ann Volker",
                ].map((name) => (
                  <p key={name} className="text-gray-700 text-base">
                    {name}
                  </p>
                ))}
              </div>
              <p className="text-center text-sm text-gray-500 mt-8 italic">
                With gratitude for their generous support
              </p>
            </div>

            {/* START: President's Letter Section */}
            <div className="max-w-4xl mx-auto mt-16 mb-24 pb-16">
              <div className="bg-slate-50 p-8 sm:p-12 rounded-lg shadow-sm border-l-4 border-[#d4af37] relative">
                
                {/* Decorative Quotation Mark Background */}
                <div className="absolute top-4 right-6 text-9xl text-[#d4af37]/10 font-serif leading-none select-none">
                  &rdquo;
                </div>

                <h4 className="text-3xl font-light text-[#1a1a2e] mb-8 tracking-wide border-b border-gray-200 pb-4">
                  A Message from the President
                </h4>

                <div className="space-y-6 text-lg text-gray-700 leading-relaxed font-serif">
                  <p>
                    It is a privilege to serve as President of the Odessa Symphony
                    Guild for the 2026–2027 season. For nearly seven decades, the
                    Guild has been an important part of the cultural life of West
                    Texas, bringing together people who share a love for the arts,
                    a commitment to service, and a desire to ensure that symphonic
                    music continues to thrive in our community.
                  </p>

                  <p>
                    Since its founding in 1958, the Odessa Symphony Guild has grown
                    from a small group of dedicated music supporters into an
                    organization whose impact reaches far beyond the concert hall.
                    Through our partnership with the West Texas Symphony, our
                    members provide both financial support and countless hours of
                    volunteer service. We are proud to stand alongside the
                    musicians, directors, students, families, and community members
                    who make the arts such a meaningful part of life in the Permian
                    Basin.
                  </p>

                  <p>
                    One of the Guild’s greatest sources of pride is our Belles and
                    Beaux program. Each year, more than 100 students in grades 9–12
                    learn the importance of giving back through service to the
                    Guild, the West Texas Symphony, and other organizations
                    throughout our community. In a single season, our Belles and
                    Beaux have contributed more than 1,200 volunteer hours. Watching
                    these young people grow in leadership, responsibility, and
                    service is one of the most rewarding parts of our mission.
                  </p>

                  <p>
                    The Guild is equally committed to investing in the future of
                    the arts. Our support includes significant annual contributions
                    to the West Texas Symphony, grants for arts initiatives
                    throughout West Texas, and scholarships for graduating senior
                    Belles and Beaux. In recent seasons, we have continued to expand
                    that commitment. This year we were able to give $15,000 in
                    grants to support arts initiatives in West Texas, and we were
                    able to award eight $2,500 scholarships to very deserving belles
                    and beaux. These investments allow us not only to support the
                    arts today, but also to encourage the young people who will
                    carry that appreciation forward.
                  </p>

                  <p>
                    Our members serve in many other ways throughout the year. We
                    help sponsor symphony performances and provide meals for
                    directors and musicians through our Sound Bytes program. Behind
                    each of these efforts are Guild members generously giving their
                    time, talents, and resources to support the people who bring
                    exceptional live music to West Texas.
                  </p>

                  <p>
                    Each February, we also come together for one of our most
                    cherished traditions, the Symphony Ball. This special evening
                    is both a celebration and a culmination of the Belles and Beaux
                    season, giving us the opportunity to recognize our senior
                    Belles and Beaux for their years of service while celebrating
                    the dedication of all of our participating students and
                    families. This year’s theme is Breakfast at Tiffany’s, and our
                    ball committee has been working diligently to plan an
                    unforgettable evening!
                  </p>

                  <p>
                    As we begin the 2026–2027 season, I am grateful for the
                    generations of women who built this organization and for the
                    members who continue their legacy today. Their commitment has
                    allowed the Odessa Symphony Guild to remain a strong advocate
                    for music, education, and the arts for nearly 70 years.
                  </p>

                  <p className="font-medium text-[#1a1a2e]">
                    We hope you will continue supporting the Odessa Symphony Guild
                    by becoming a Patron Member. Patron membership offers the same
                    benefits and privileges as active membership, with the exception
                    of voting or holding office within the Guild. Patron dues for
                    the 2026-2027 year are $100 and should be submitted to our
                    treasurer, Katie Sparks, by January 12, 2026. When submitting
                    your payment, please be sure to include “PATRON” on the form of
                    payment so it can be properly designated.
                  </p>

                  <p>
                    Our Patron Liaisons, Ashley Capellini and Connie Drager, are
                    looking forward to hosting a special event for our patrons this
                    spring. Additional details and invitations will be shared as
                    the event approaches. I am truly grateful for your continued
                    support of the Odessa Symphony Guild. Your generosity and
                    involvement make it possible for us to continue supporting the
                    West Texas Symphony while strengthening and celebrating the
                    arts throughout our community.
                  </p>

                  <p>
                    I look forward to all that we will accomplish together this
                    year. Thank you for supporting the Odessa Symphony Guild, the
                    West Texas Symphony, and the arts that enrich our entire West
                    Texas community.
                  </p>
                </div>

                <div className="mt-10 pt-6">
                  <p className="text-gray-700 font-serif">With gratitude,</p>
                  <div className="mt-4">
                    {/* Using your specific title font for the signature */}
                    <p className="font-tangerine text-5xl text-[#d4af37] mb-2">
                      Shaylee Ford
                    </p>
                    <p className="text-sm uppercase tracking-widest text-gray-500 font-sans">
                      President, 2026–2027
                      <br />
                      Odessa Symphony Guild
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* END: President's Letter Section */}

            {/* Symphony SoundBites - Image Left */}
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Image Container - No fixed height, lets image size itself */}
              <div className="rounded-lg overflow-hidden shadow-xl group">
                <Image
                  src="/images/soundbite-icon.jpg"
                  alt="Symphony SoundBites intimate performance collage"
                  /* 
                     IMPORTANT: Set width/height to the actual dimensions of your image 
                     or a generic aspect ratio (e.g., 1000x800). 
                     'w-full h-auto' will make it responsive while keeping aspect ratio.
                  */
                  width={1000} 
                  height={750}
                  className="w-full h-auto object-contain transition-transform duration-700 group-hover:scale-105"
                />
              </div>

              {/* Text Content */}
              <div className="lg:pl-8">
                <div className="inline-block mb-4">
                  <div className="h-1 w-16 bg-[#d4af37]" />
                </div>
                <h3 className="text-3xl sm:text-4xl font-light mb-6 text-[#1a1a2e] tracking-wide">
                  Symphony SoundBites
                </h3>
                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                  Our volunteers work tirelessly to prepare and execute Symphony
                  SoundBites events, creating intimate musical experiences that
                  bring our community closer to the artistry of the symphony.
                </p>
                <p className="text-base text-gray-600 leading-relaxed">
                  These curated events offer audiences unique opportunities to
                  experience chamber music and connect personally with our talented
                  musicians in elegant, intimate settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Belles & Beaux Section */}
      <section id="belle-beaux" className="py-20 sm:py-24 lg:py-32 bg-gradient-to-br from-[#2d3748] to-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl sm:text-5xl font-light text-center mb-6 tracking-wider">
            Belles & Beaux Program
          </h2>
          <p className="text-center text-xl text-[#d4af37] max-w-2xl mx-auto mb-20">
            Developing tomorrow's leaders through service and appreciation of the
            arts
          </p>

          {/* Main Content with Offset Images */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-16">
            {/* Text Content */}
            <div className="order-2 lg:order-1">
              <h3 className="text-3xl sm:text-4xl font-light mb-6 text-[#d4af37]">
                Cultivating Future Leaders
              </h3>
              <p className="text-lg leading-relaxed mb-8 opacity-95">
                The Odessa Symphony Guild proudly sponsors the Belles and Beaux
                program for young men and women in grades 9-12. This
                distinguished program introduces students to the arts while
                instilling the values of community service and leadership.
              </p>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <span className="text-[#d4af37] text-xl mt-1">♦</span>
                  <span>Four years of meaningful service to the community</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#d4af37] text-xl mt-1">♦</span>
                  <span>
                    Hands-on experience supporting symphony events and concerts
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#d4af37] text-xl mt-1">♦</span>
                  <span>Development of leadership skills and social grace</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#d4af37] text-xl mt-1">♦</span>
                  <span>
                    Cultivation of lifelong appreciation for the performing arts
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#d4af37] text-xl mt-1">♦</span>
                  <span>
                    Recognition and celebration at the annual Symphony Gala Ball
                  </span>
                </li>
              </ul>

              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg border border-[#d4af37]/30">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-5xl font-light text-[#d4af37]">65+</span>
                  <div>
                    <p className="font-semibold text-[#d4af37]">
                      Years of Supporting Excellence
                    </p>
                  </div>
                </div>
                <p className="text-sm opacity-90 leading-relaxed">
                  Our Belles and Beaux program shapes young leaders who carry
                  forward the Guild's mission, ensuring that appreciation for the
                  arts and commitment to service continue for generations to
                  come.
                </p>
              </div>
            </div>

            {/* Offset Images Grid */}
            <div className="order-1 lg:order-2 relative">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative h-64 sm:h-80 rounded-lg overflow-hidden shadow-2xl transform hover:scale-105 transition-transform">
                  <Image
                    src="/images/volunteer.jpg"
                    alt="Student volunteers at symphony event"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative h-64 sm:h-80 rounded-lg overflow-hidden shadow-2xl mt-12 transform hover:scale-105 transition-transform">
                  <Image
                    src="/images/beaus_belles_2026.jpg"
                    alt="Belles and Beaux presentation"
                    fill
                    className="object-cover object-top"
                  />
                </div>
              </div>
              <div className="relative h-48 sm:h-64 rounded-lg overflow-hidden shadow-2xl mt-4 transform hover:scale-105 transition-transform">
                <Image
                  src="/images/movie.jpg"
                  alt="Symphony gala event"
                  fill
                  className="object-cover object-top"
                />
              </div>
            </div>
          </div>

          {/* Additional Program Benefits */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="text-center p-6 bg-white/5 rounded-lg backdrop-blur-sm">
              <div className="text-4xl mb-3">🎓</div>
              <h4 className="text-xl font-semibold mb-3 text-[#d4af37]">
                Leadership Development
              </h4>
              <p className="text-sm opacity-90">
                Students gain valuable experience in event planning, public
                speaking, and community engagement
              </p>
            </div>
            <div className="text-center p-6 bg-white/5 rounded-lg backdrop-blur-sm">
              <div className="text-4xl mb-3">🎻</div>
              <h4 className="text-xl font-semibold mb-3 text-[#d4af37]">
                Arts Appreciation
              </h4>
              <p className="text-sm opacity-90">
                Direct exposure to world-class musical performances and
                professional musicians
              </p>
            </div>
            <div className="text-center p-6 bg-white/5 rounded-lg backdrop-blur-sm">
              <div className="text-4xl mb-3">🤝</div>
              <h4 className="text-xl font-semibold mb-3 text-[#d4af37]">
                Community Connection
              </h4>
              <p className="text-sm opacity-90">
                Build lasting relationships with peers and community leaders
                through shared service
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 sm:py-24 lg:py-32 bg-[#1a1a2e] text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl sm:text-5xl font-light mb-8 tracking-wider">
            Join Us
          </h2>
          <p className="text-lg sm:text-xl leading-relaxed mb-12 opacity-95">
            Whether you're interested in becoming a member, supporting as a
            patron, or enrolling a student in our Belles and Beaux program, we
            welcome you to be part of our mission to bring exceptional music to
            West Texas.
          </p>

          <div className="space-y-6 mb-12">
            <p className="text-xl font-light">Connect with us on social media:</p>
            <a
              href="https://www.facebook.com/odessasymphonyguild/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 text-[#d4af37] hover:text-[#e6c855] transition-colors text-xl"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook: Odessa Symphony Guild
            </a>
          </div>

          <p className="text-base opacity-90 leading-relaxed">
            For membership inquiries and more information about supporting the
            Guild, please reach out through our Facebook page.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
