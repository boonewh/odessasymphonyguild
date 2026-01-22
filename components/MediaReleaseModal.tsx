"use client";
import { useState, FormEvent } from "react";

interface MediaReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MediaReleaseModal({ isOpen, onClose }: MediaReleaseModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  // Form state
  const [participantName, setParticipantName] = useState("");
  const [participantAddress, setParticipantAddress] = useState("");
  const [participantPhone, setParticipantPhone] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [ageVerification, setAgeVerification] = useState<"18plus" | "under18" | "">("");
  const [socialMediaOptOut, setSocialMediaOptOut] = useState(false);
  const [participantConsent, setParticipantConsent] = useState(false);

  // Minor/Guardian fields
  const [minorName, setMinorName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianConsent, setGuardianConsent] = useState(false);

  // Signature
  const [signature, setSignature] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const resetForm = () => {
    setParticipantName("");
    setParticipantAddress("");
    setParticipantPhone("");
    setParticipantEmail("");
    setAgeVerification("");
    setSocialMediaOptOut(false);
    setParticipantConsent(false);
    setMinorName("");
    setGuardianName("");
    setGuardianPhone("");
    setGuardianEmail("");
    setGuardianConsent(false);
    setSignature("");
    setAgreeToTerms(false);
    setSubmitStatus("idle");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");

    const formData = {
      participantName,
      participantAddress,
      participantPhone,
      participantEmail,
      ageVerification: ageVerification === "18plus" ? "18 years or older" : "Under 18 years",
      socialMediaOptOut: socialMediaOptOut ? "Yes - Opted OUT of social media" : "No - Social media OK",
      participantConsent: participantConsent ? "Yes" : "No",
      minorName: ageVerification === "under18" ? minorName : "N/A",
      guardianName: ageVerification === "under18" ? guardianName : "N/A",
      guardianPhone: ageVerification === "under18" ? guardianPhone : "N/A",
      guardianEmail: ageVerification === "under18" ? guardianEmail : "N/A",
      guardianConsent: ageVerification === "under18" ? (guardianConsent ? "Yes" : "No") : "N/A",
      electronicSignature: signature,
      submissionDate: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    try {
      const body = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        body.append(key, String(value));
      });


      const response = await fetch("https://formspree.io/f/xjgggwqb", {

        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      
      if (response.ok) {
        setSubmitStatus("success");
      } else {
        setSubmitStatus("error");
      }
    } catch {
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Success screen
  if (submitStatus === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center">
          <div className="text-6xl mb-4">&#10003;</div>
          <h2 className="text-2xl font-bold text-emerald-800 mb-4">Form Submitted Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Thank you for submitting the Media Release & Consent Form. A confirmation has been sent to your email.
          </p>
          <button
            onClick={handleClose}
            className="px-6 py-3 bg-emerald-800 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-emerald-900 text-white p-6 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-1">Odessa Symphony Guild</h2>
              <p className="text-emerald-200">Media Release & Consent Form</p>
            </div>
            <button
              onClick={handleClose}
              className="text-white/70 hover:text-white text-3xl leading-none"
              aria-label="Close modal"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Participant Information */}
          <section>
            <h3 className="text-lg font-semibold text-emerald-900 mb-4 pb-2 border-b border-emerald-200">
              Participant Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Participant Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Participant Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={participantAddress}
                  onChange={(e) => setParticipantAddress(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={participantPhone}
                    onChange={(e) => setParticipantPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={participantEmail}
                    onChange={(e) => setParticipantEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Age Verification */}
          <section>
            <h3 className="text-lg font-semibold text-emerald-900 mb-4 pb-2 border-b border-emerald-200">
              Age Verification <span className="text-red-500">*</span>
            </h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="ageVerification"
                  required
                  checked={ageVerification === "18plus"}
                  onChange={() => setAgeVerification("18plus")}
                  className="w-5 h-5 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-gray-700">The participant is 18 years of age or older</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="ageVerification"
                  required
                  checked={ageVerification === "under18"}
                  onChange={() => setAgeVerification("under18")}
                  className="w-5 h-5 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-gray-700">The participant is under 18 years of age</span>
              </label>
              {ageVerification === "under18" && (
                <p className="text-amber-600 text-sm ml-8">
                  Parental or legal guardian consent is required below.
                </p>
              )}
            </div>
          </section>

          {/* Media Release Authorization */}
          <section>
            <h3 className="text-lg font-semibold text-emerald-900 mb-4 pb-2 border-b border-emerald-200">
              Media Release Authorization
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 space-y-4">
              <p>
                By submitting this form, I grant permission to the Odessa Symphony Guild, a Texas nonprofit
                organization, to photograph, video record, and otherwise capture the image, likeness, voice,
                and/or participation of the participant during Guild-related activities and events.
              </p>
              <p>
                I authorize the Odessa Symphony Guild to use, reproduce, publish, distribute, and display
                such media, in whole or in part, in any format now known or later developed, for lawful
                nonprofit purposes, including but not limited to:
              </p>
              <ul className="list-disc ml-6 space-y-1">
                <li>Organization website</li>
                <li>Social media platforms</li>
                <li>Promotional and marketing materials</li>
                <li>Educational materials</li>
                <li>Newsletters, reports, and presentations</li>
                <li>Fundraising and outreach efforts</li>
              </ul>
              <p className="font-medium">I understand and agree that:</p>
              <ul className="list-disc ml-6 space-y-1">
                <li>No compensation will be provided for the use of these materials</li>
                <li>Media may be used with or without identifying the participant by name</li>
                <li>All media becomes the property of the Odessa Symphony Guild</li>
                <li>The Odessa Symphony Guild is not obligated to use any media captured</li>
                <li>Consent is perpetual unless revoked in writing</li>
                <li>Revocation requests must be submitted in writing and apply only to future use after receipt</li>
              </ul>
              <p>
                I hereby release and hold harmless the Odessa Symphony Guild, its officers, members,
                employees, volunteers, and affiliates from any claims, demands, or liabilities arising
                from the use of these materials.
              </p>
              <p className="italic">This agreement is governed by the laws of the State of Texas.</p>
            </div>
          </section>

          {/* Social Media Opt-Out */}
          <section>
            <h3 className="text-lg font-semibold text-emerald-900 mb-4 pb-2 border-b border-emerald-200">
              Social Media Opt-Out (Optional)
            </h3>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={socialMediaOptOut}
                onChange={(e) => setSocialMediaOptOut(e.target.checked)}
                className="w-5 h-5 mt-0.5 text-emerald-600 focus:ring-emerald-500 rounded"
              />
              <span className="text-gray-700">
                I do <strong>NOT</strong> give permission for images or video to be used on social media.
                <span className="block text-sm text-gray-500 mt-1">
                  (Other approved nonprofit uses may still apply.)
                </span>
              </span>
            </label>
          </section>

          {/* Participant Consent (18+) */}
          {ageVerification === "18plus" && (
            <section>
              <h3 className="text-lg font-semibold text-emerald-900 mb-4 pb-2 border-b border-emerald-200">
                Participant Consent (18 Years or Older)
              </h3>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={participantConsent}
                  onChange={(e) => setParticipantConsent(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-emerald-600 focus:ring-emerald-500 rounded"
                />
                <span className="text-gray-700">
                  I certify that I am at least 18 years of age and that I voluntarily consent to the
                  terms of this Media Release. <span className="text-red-500">*</span>
                </span>
              </label>
            </section>
          )}

          {/* Parental/Guardian Consent (Under 18) */}
          {ageVerification === "under18" && (
            <section>
              <h3 className="text-lg font-semibold text-emerald-900 mb-4 pb-2 border-b border-emerald-200">
                Parental / Legal Guardian Consent
              </h3>
              <p className="text-sm text-amber-600 mb-4">Required if participant is under 18</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minor&apos;s Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={minorName}
                    onChange={(e) => setMinorName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parent / Legal Guardian Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                    />
                  </div>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={guardianConsent}
                    onChange={(e) => setGuardianConsent(e.target.checked)}
                    className="w-5 h-5 mt-0.5 text-emerald-600 focus:ring-emerald-500 rounded"
                  />
                  <span className="text-gray-700">
                    I affirm that I am the parent or legal guardian of the minor named above and have
                    the legal authority to grant this consent under Texas law. <span className="text-red-500">*</span>
                  </span>
                </label>
              </div>
            </section>
          )}

          {/* Electronic Signature */}
          <section>
            <h3 className="text-lg font-semibold text-emerald-900 mb-4 pb-2 border-b border-emerald-200">
              Electronic Signature & Submission
            </h3>
            <div className="bg-amber-50 p-4 rounded-lg text-sm text-gray-700 mb-4">
              <p className="font-medium mb-2">By typing my name below and submitting this form, I acknowledge that:</p>
              <ul className="list-disc ml-6 space-y-1">
                <li>I have read and understand this Media Release & Consent Form</li>
                <li>I agree that my typed name constitutes a valid electronic signature</li>
                <li>This submission is legally binding to the same extent as a handwritten signature</li>
              </ul>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Electronic Signature (Type Full Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Type your full legal name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 italic"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="text"
                  readOnly
                  value={new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600"
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-emerald-600 focus:ring-emerald-500 rounded"
                />
                <span className="text-gray-700">
                  I agree to the terms above <span className="text-red-500">*</span>
                </span>
              </label>
            </div>
          </section>

          {/* Error Message */}
          {submitStatus === "error" && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
              There was an error submitting the form. Please try again or contact us directly.
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !ageVerification}
              className="w-full py-4 bg-emerald-800 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Submitting..." : "Submit Media Release Form"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
