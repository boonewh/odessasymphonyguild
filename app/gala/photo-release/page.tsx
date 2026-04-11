"use client";

import { useState, FormEvent } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const inputClass =
  "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 text-sm transition-colors";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

export default function PhotoReleasePage() {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");

  // Student fields
  const [studentName, setStudentName] = useState("");

  // Guardian fields
  const [guardianName, setGuardianName]       = useState("");
  const [guardianAddress, setGuardianAddress] = useState("");
  const [guardianCity, setGuardianCity]       = useState("");
  const [guardianState, setGuardianState]     = useState("");
  const [guardianZip, setGuardianZip]         = useState("");
  const [guardianPhone, setGuardianPhone]     = useState("");
  const [guardianEmail, setGuardianEmail]     = useState("");

  // Consent & signature
  const [socialMediaOptOut, setSocialMediaOptOut] = useState(false);
  const [guardianConsent, setGuardianConsent]     = useState(false);
  const [agreeToTerms, setAgreeToTerms]           = useState(false);
  const [signature, setSignature]                 = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitStatus("submitting");

    const formData = {
      "Student Name":          studentName,
      "Guardian Name":         guardianName,
      "Guardian Address":      `${guardianAddress}, ${guardianCity}, ${guardianState} ${guardianZip}`.trim(),
      "Guardian Phone":        guardianPhone,
      "Guardian Email":        guardianEmail,
      "Social Media Opt-Out":  socialMediaOptOut ? "Yes — opted OUT of social media" : "No — social media OK",
      "Guardian Consent":      guardianConsent ? "Yes" : "No",
      "Electronic Signature":  signature,
      "Submission Date":       new Date().toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      }),
    };

    try {
      const response = await fetch("https://formspree.io/f/xjgggwqb", {
        method:  "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body:    JSON.stringify(formData),
      });
      setSubmitStatus(response.ok ? "success" : "error");
    } catch {
      setSubmitStatus("error");
    }
  };

  if (submitStatus === "success") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-xl mx-auto px-6 py-24 text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">Form Submitted</h2>
            <p className="text-gray-500 text-sm mb-8">
              Thank you. Your media release has been received and a confirmation
              will be sent to the email address provided.
            </p>
            <a
              href="/gala"
              className="inline-block px-6 py-3 bg-emerald-800 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold"
            >
              ← Back to Gala
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#051a12] to-[#0f382a] py-14 text-center text-white">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-emerald-400 text-xs tracking-[0.3em] uppercase mb-3">
            Odessa Symphony Guild
          </p>
          <h1 className="text-4xl font-light tracking-wide mb-4">
            Student Photo Release
          </h1>
          <div className="h-px w-20 bg-amber-400 mx-auto mb-4" />
          <p className="text-sm opacity-70 font-light">
            Media Release &amp; Consent Form — Complete one form per student
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="max-w-2xl mx-auto px-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-8">

            {/* Authorization text */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-lg font-semibold text-emerald-900 mb-4 pb-2 border-b border-emerald-100">
                Media Release Authorization
              </h2>
              <div className="text-sm text-gray-600 space-y-3 leading-relaxed">
                <p>
                  By submitting this form, the parent or guardian named below grants permission to the
                  Odessa Symphony Guild, a Texas nonprofit organization, to photograph, video record,
                  and otherwise capture the image, likeness, voice, and/or participation of the student
                  during Guild-related activities and events.
                </p>
                <p>
                  The Guild may use, reproduce, publish, distribute, and display such media in any
                  format for lawful nonprofit purposes, including: the organization website, social
                  media platforms, promotional and marketing materials, educational materials,
                  newsletters, reports, presentations, and fundraising efforts.
                </p>
                <ul className="list-disc ml-5 space-y-1 text-gray-500">
                  <li>No compensation will be provided for the use of these materials</li>
                  <li>Media may be used with or without identifying the student by name</li>
                  <li>All media becomes the property of the Odessa Symphony Guild</li>
                  <li>Consent is perpetual unless revoked in writing</li>
                </ul>
                <p className="italic text-gray-500 text-xs">
                  This agreement is governed by the laws of the State of Texas.
                </p>
              </div>
            </div>

            {/* Student info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-lg font-semibold text-emerald-900 mb-6 pb-2 border-b border-emerald-100">
                Student Information
              </h2>
              <div>
                <label className={labelClass}>
                  Student Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Guardian info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-lg font-semibold text-emerald-900 mb-6 pb-2 border-b border-emerald-100">
                Parent / Legal Guardian Information
              </h2>
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Mailing Address</label>
                  <input
                    type="text"
                    value={guardianAddress}
                    onChange={(e) => setGuardianAddress(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className={labelClass}>City</label>
                    <input
                      type="text"
                      value={guardianCity}
                      onChange={(e) => setGuardianCity(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>State</label>
                    <input
                      type="text"
                      value={guardianState}
                      onChange={(e) => setGuardianState(e.target.value)}
                      placeholder="TX"
                      maxLength={2}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Zip Code</label>
                    <input
                      type="text"
                      value={guardianZip}
                      onChange={(e) => setGuardianZip(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      placeholder="(xxx) xxx-xxxx"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Social media opt-out */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-lg font-semibold text-emerald-900 mb-4 pb-2 border-b border-emerald-100">
                Social Media (Optional)
              </h2>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={socialMediaOptOut}
                  onChange={(e) => setSocialMediaOptOut(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-emerald-600 focus:ring-emerald-500 rounded accent-emerald-700"
                />
                <span className="text-sm text-gray-700">
                  I do <strong>NOT</strong> give permission for images or video to be used on social media.
                  <span className="block text-xs text-gray-400 mt-0.5">
                    Other approved nonprofit uses (website, print materials, etc.) may still apply.
                  </span>
                </span>
              </label>
            </div>

            {/* Consent & signature */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-lg font-semibold text-emerald-900 mb-6 pb-2 border-b border-emerald-100">
                Consent &amp; Electronic Signature
              </h2>
              <div className="space-y-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={guardianConsent}
                    onChange={(e) => setGuardianConsent(e.target.checked)}
                    className="w-5 h-5 mt-0.5 text-emerald-600 focus:ring-emerald-500 rounded accent-emerald-700"
                  />
                  <span className="text-sm text-gray-700">
                    I affirm that I am the parent or legal guardian of the student named above and have
                    the legal authority to grant this consent under Texas law.{" "}
                    <span className="text-red-500">*</span>
                  </span>
                </label>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-gray-600">
                  By typing my name below I acknowledge that I have read and agree to the Media Release
                  Authorization above, and that my typed name constitutes a valid electronic signature
                  legally binding to the same extent as a handwritten signature.
                </div>

                <div>
                  <label className={labelClass}>
                    Electronic Signature — Type Full Legal Name{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Type your full legal name"
                    className={`${inputClass} italic`}
                  />
                </div>

                <div>
                  <label className={labelClass}>Date</label>
                  <input
                    type="text"
                    readOnly
                    value={new Date().toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 text-sm"
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    className="w-5 h-5 mt-0.5 text-emerald-600 focus:ring-emerald-500 rounded accent-emerald-700"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the terms above. <span className="text-red-500">*</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Error */}
            {submitStatus === "error" && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                There was an error submitting the form. Please try again or contact us directly.
              </div>
            )}

            <button
              type="submit"
              disabled={submitStatus === "submitting"}
              className="w-full py-4 bg-emerald-800 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitStatus === "submitting" ? "Submitting..." : "Submit Media Release Form"}
            </button>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
}
