import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";

export default function JoinConfirmation() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section className="py-24 bg-gray-50">
        <div className="max-w-xl mx-auto px-6 text-center">

          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-light text-[#1a1a2e] mb-3">
            Application Received!
          </h1>
          <div className="h-px w-16 bg-[#d4af37] mx-auto mb-6" />
          <p className="text-gray-600 mb-4 leading-relaxed">
            Thank you for applying to the{" "}
            <span className="font-semibold text-[#1a1a2e]">
              Odessa Symphony Guild Belles &amp; Beaux
            </span>{" "}
            program for the {BELLES_BEAUX_CONFIG.schoolYear} season.
          </p>
          <p className="text-gray-600 mb-10 leading-relaxed">
            A payment link for your dues will be sent to you shortly. Your membership will be
            confirmed once payment is received.
          </p>

          <a
            href="/belles-beaux"
            className="inline-block border-2 border-[#d4af37] text-[#d4af37] px-8 py-3 rounded-lg font-semibold hover:bg-[#d4af37] hover:text-[#1a1a2e] transition-colors"
          >
            Back to Belles &amp; Beaux
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
