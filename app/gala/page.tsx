import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function GalaPage() {
  return (
    <div className="min-h-screen">
      <Header />
      {/* Hero Section */}
      <section className="relative min-h-[50vh] flex items-center justify-center text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/gala-ball-event.jpg"
            alt="Symphony Gala Ball"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a2e]/80" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <h1 className="font-tangerine text-6xl sm:text-7xl md:text-8xl font-bold mb-6 text-white drop-shadow-[4px_4px_8px_rgba(0,0,0,0.8)]">
            Annual Symphony Gala Ball
          </h1>
          <p className="text-xl sm:text-2xl font-light tracking-wide text-[#d4af37]">
            An elegant evening celebrating service, achievement, and the arts
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 sm:py-24 lg:py-32 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl sm:text-4xl font-light mb-6 text-[#1a1a2e]">
                A Night to Remember
              </h2>

              <div className="space-y-6 text-lg leading-relaxed text-gray-700">
                <p>
                  Our annual Symphony Gala Ball is the highlight of the social
                  season, honoring our dedicated Belles and Beaux while raising
                  vital funds to support the West Texas Symphony.
                </p>

                <p>
                  The evening features the formal presentation of our freshman,
                  sophomore, and junior Belles and Beaux, culminating in a special
                  recognition of our seniors and their four years of exemplary
                  service to the Guild and our community.
                </p>

                <p>
                  This elegant affair brings together Guild members, patrons,
                  families, and symphony supporters for an unforgettable
                  celebration of music, service, and community.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 sm:py-24 lg:py-32 bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] text-white">
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