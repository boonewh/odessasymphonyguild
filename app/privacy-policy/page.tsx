import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] py-16 text-center text-white">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-4xl sm:text-5xl font-light tracking-wide mb-4">
            Privacy Policy
          </h1>
          <div className="h-px w-20 bg-[#d4af37] mx-auto mb-4" />
          <p className="text-sm opacity-60 font-light">
            Odessa Symphony Guild &mdash; Effective April 1, 2026
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 prose prose-gray">
          <div className="space-y-8 text-gray-700 leading-relaxed">

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">1. Who We Are</h2>
              <p>
                The Odessa Symphony Guild ("OSG," "we," "us," or "our") is a nonprofit organization
                located in Odessa, Texas. This privacy policy applies to information collected through
                our website at <strong>odessasymphonyguild.com</strong>, including the Belles &amp;
                Beaux membership enrollment application.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">2. Information We Collect</h2>
              <p>We collect the following information when you submit a Belles &amp; Beaux membership application:</p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>Student name, grade, school, gender, and t-shirt size</li>
                <li>Student cell phone number</li>
                <li>Parent or guardian name, mailing address, phone number, and email address</li>
                <li>Formal presentation name for Gala purposes</li>
                <li>Membership type and dues payment status</li>
              </ul>
              <p className="mt-3">
                We do not collect or store credit card numbers or payment account information.
                Payment is processed securely through QuickBooks Payments, subject to Intuit&apos;s
                own privacy policy.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">3. How We Use Your Information</h2>
              <p>Information collected is used solely for:</p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>Processing Belles &amp; Beaux membership enrollment</li>
                <li>Generating and delivering membership invoices via QuickBooks</li>
                <li>Communicating with parents and guardians regarding program activities and events</li>
                <li>Internal administrative recordkeeping by OSG officers</li>
                <li>Gala presentation coordination</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">4. How We Share Your Information</h2>
              <p>
                We do not sell, trade, or rent your personal information to third parties. Information
                may be shared with:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>
                  <strong>Intuit / QuickBooks</strong> — for invoice generation and payment processing
                </li>
                <li>
                  <strong>OSG board members and officers</strong> — for program administration
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">5. Data Storage and Security</h2>
              <p>
                Membership records are stored securely using Supabase, a cloud database provider
                with encryption at rest and in transit. Access to student records is restricted to
                authorized OSG administrators through a password-protected interface.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">6. Data Retention</h2>
              <p>
                Student and parent information is retained for the duration of the student&apos;s
                participation in the Belles &amp; Beaux program and for a reasonable period
                thereafter for recordkeeping purposes. You may request deletion of your information
                by contacting us at the address below.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">7. Children&apos;s Privacy</h2>
              <p>
                The Belles &amp; Beaux program serves students in grades 9–12. All enrollment
                applications require parent or guardian contact information. We do not knowingly
                collect information from children under 13 without verifiable parental consent.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">8. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>Request access to the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your information</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, contact us at the address below.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">9. Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. Any changes will be posted
                on this page with an updated effective date.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-3">10. Contact Us</h2>
              <p>
                If you have questions about this privacy policy or how your information is handled,
                please contact:
              </p>
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
