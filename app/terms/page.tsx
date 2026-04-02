import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] py-16 text-center text-white">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-4xl sm:text-5xl font-light tracking-wide mb-4">
            Terms of Use
          </h1>
          <div className="h-px w-20 bg-[#d4af37] mx-auto mb-4" />
          <p className="text-sm opacity-60 font-light">
            Odessa Symphony Guild &mdash; Effective April 1, 2026
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6">
          <div className="space-y-8 text-gray-700 leading-relaxed">

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing or using the Odessa Symphony Guild website and Belles &amp; Beaux
                enrollment application ("the Service"), you agree to be bound by these Terms of
                Use. If you do not agree, please do not use the Service.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">2. Purpose of the Service</h2>
              <p>
                This website and application are operated by the Odessa Symphony Guild, a nonprofit
                organization, for the purpose of:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>Providing information about OSG programs and events</li>
                <li>Processing Belles &amp; Beaux membership enrollment applications</li>
                <li>Facilitating dues payment through QuickBooks Payments</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">3. Membership Enrollment</h2>
              <p>
                By submitting a Belles &amp; Beaux enrollment application, you confirm that:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>All information provided is accurate and complete</li>
                <li>You are a parent or guardian authorized to enroll the student</li>
                <li>You agree to pay the applicable dues and fees for the membership year</li>
                <li>
                  You understand that a late fee of $100 will be added to any balance unpaid
                  after June 30, 2026
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">4. Payment</h2>
              <p>
                Dues payments are processed through QuickBooks Payments, a service provided by
                Intuit Inc. By proceeding to payment, you agree to Intuit&apos;s terms of service.
                The Odessa Symphony Guild does not store credit card or payment account information.
              </p>
              <p className="mt-3">
                All sales of membership dues are final. Refund requests may be submitted in writing
                to the OSG Treasurer and are subject to board approval.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">5. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>Submit false or misleading information</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
                <li>Use the Service for any purpose other than its intended use</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">6. Intellectual Property</h2>
              <p>
                All content on this website, including text, images, and design, is the property
                of the Odessa Symphony Guild and may not be reproduced without written permission.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">7. Disclaimer</h2>
              <p>
                The Service is provided "as is" without warranties of any kind. The Odessa Symphony
                Guild is not liable for any damages arising from your use of the Service.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">8. Changes to These Terms</h2>
              <p>
                We reserve the right to update these terms at any time. Continued use of the
                Service after changes are posted constitutes acceptance of the revised terms.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">9. Contact</h2>
              <p>Questions about these terms may be directed to:</p>
              <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                <p className="font-semibold text-[#1a1a2e]">Odessa Symphony Guild</p>
                <p>P.O. Box 14522</p>
                <p>Odessa, TX 79768</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
