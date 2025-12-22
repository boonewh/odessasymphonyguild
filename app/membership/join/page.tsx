"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FormStepIndicator from "@/components/FormStepIndicator";
import MembershipTierSelector from "@/components/MembershipTierSelector";
import PaymentFormPlaceholder from "@/components/PaymentFormPlaceholder";
import { MembershipFormData, FormStep } from "@/types/membership";
import {
  membershipFormSchema,
  formatPhoneNumber,
} from "@/lib/validation/membership";
import {
  getMembershipTier,
  getDefaultTier,
  MEMBERSHIP_YEAR,
} from "@/lib/membership/config";

function JoinFormContent() {
  const searchParams = useSearchParams();
  const tierParam = searchParams.get("tier");

  const [currentStep, setCurrentStep] = useState<FormStep>("tier");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MembershipFormData>({
    resolver: zodResolver(membershipFormSchema),
    defaultValues: {
      tierId: tierParam || getDefaultTier().id,
      newsletterOptIn: true,
    },
  });

  const selectedTierId = watch("tierId");
  const selectedTier = getMembershipTier(selectedTierId);

  // Format phone number as user types
  const phoneValue = watch("phone");
  useEffect(() => {
    if (phoneValue) {
      const formatted = formatPhoneNumber(phoneValue);
      if (formatted !== phoneValue) {
        setValue("phone", formatted);
      }
    }
  }, [phoneValue, setValue]);

  const handleNextStep = () => {
    if (currentStep === "tier") {
      setCurrentStep("info");
    } else if (currentStep === "info") {
      // Trigger validation for info fields
      handleSubmit(
        () => {
          setCurrentStep("payment");
        },
        (errors) => {
          console.log("Validation errors:", errors);
        }
      )();
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === "payment") {
      setCurrentStep("info");
    } else if (currentStep === "info") {
      setCurrentStep("tier");
    }
  };

  const handlePaymentSubmit = async () => {
    setIsSubmitting(true);

    try {
      const formData = watch();

      // In production, this would call the API route
      // For now, simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Generate mock submission ID
      const mockId = `OSG-${Date.now()}`;
      setSubmissionId(mockId);

      // Move to confirmation step
      setCurrentStep("confirmation");
    } catch (error) {
      console.error("Submission error:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] text-white py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="font-tangerine text-5xl sm:text-6xl md:text-7xl font-bold mb-4">
            Join the Guild
          </h1>
          <p className="text-xl text-[#d4af37]">
            Complete your membership for {MEMBERSHIP_YEAR.current}
          </p>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <FormStepIndicator currentStep={currentStep} />

          {/* Step 1: Select Tier */}
          {currentStep === "tier" && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-light text-[#1a1a2e] mb-3">
                  Select Your Membership Level
                </h2>
                <p className="text-gray-600">
                  Choose the membership tier that's right for you
                </p>
              </div>

              <MembershipTierSelector
                selectedTierId={selectedTierId}
                onSelectTier={(tierId) => setValue("tierId", tierId)}
              />

              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="bg-[#d4af37] text-[#1a1a2e] px-8 py-3 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors"
                >
                  Continue to Your Information
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Member Information */}
          {currentStep === "info" && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-light text-[#1a1a2e] mb-3">
                  Your Information
                </h2>
                <p className="text-gray-600">
                  Tell us about yourself so we can create your membership
                </p>
              </div>

              <form className="max-w-2xl mx-auto space-y-6">
                {/* Name Fields */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...register("firstName")}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.firstName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...register("lastName")}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email and Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    {...register("email")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    {...register("phone")}
                    placeholder="(555) 555-5555"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.phone.message}
                    </p>
                  )}
                </div>

                {/* Address (Optional) */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-[#1a1a2e] mb-4">
                    Mailing Address{" "}
                    <span className="text-sm text-gray-500 font-normal">
                      (Optional)
                    </span>
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Street Address
                      </label>
                      <input
                        type="text"
                        {...register("address.street")}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                      />
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          City
                        </label>
                        <input
                          type="text"
                          {...register("address.city")}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          State
                        </label>
                        <input
                          type="text"
                          {...register("address.state")}
                          placeholder="TX"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ZIP Code
                        </label>
                        <input
                          type="text"
                          {...register("address.zipCode")}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Newsletter Opt-in */}
                <div className="pt-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register("newsletterOptIn")}
                      className="mt-1 w-5 h-5 text-[#d4af37] border-gray-300 rounded focus:ring-[#d4af37]"
                    />
                    <span className="text-sm text-gray-700">
                      Yes, I'd like to receive updates about Guild events,
                      Symphony performances, and volunteer opportunities.
                    </span>
                  </label>
                </div>
              </form>

              {/* Navigation Buttons */}
              <div className="mt-8 flex justify-between max-w-2xl mx-auto">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="bg-[#d4af37] text-[#1a1a2e] px-8 py-3 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors"
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {currentStep === "payment" && selectedTier && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-light text-[#1a1a2e] mb-3">
                  Complete Your Membership
                </h2>
                <p className="text-gray-600">
                  You've selected the{" "}
                  <span className="font-semibold text-[#d4af37]">
                    {selectedTier.name}
                  </span>{" "}
                  membership
                </p>
              </div>

              <PaymentFormPlaceholder
                amount={selectedTier.price}
                onSubmit={handlePaymentSubmit}
                isSubmitting={isSubmitting}
              />

              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  disabled={isSubmitting}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {currentStep === "confirmation" && selectedTier && (
            <div className="max-w-2xl mx-auto text-center">
              <div className="mb-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">✓</span>
                </div>
                <h2 className="text-4xl font-light text-[#1a1a2e] mb-4">
                  Welcome to the Guild!
                </h2>
                <p className="text-xl text-[#d4af37] mb-2">
                  Thank you for becoming a member
                </p>
                {submissionId && (
                  <p className="text-sm text-gray-600">
                    Confirmation: {submissionId}
                  </p>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
                <h3 className="font-semibold text-[#1a1a2e] mb-4">
                  Membership Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Membership Level:</span>
                    <span className="font-semibold">{selectedTier.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Annual Dues:</span>
                    <span className="font-semibold">
                      ${selectedTier.price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Membership Period:</span>
                    <span className="font-semibold">
                      {MEMBERSHIP_YEAR.current}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valid Through:</span>
                    <span className="font-semibold">
                      {MEMBERSHIP_YEAR.endDate}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-gray-700 mb-8">
                <h3 className="font-semibold text-[#1a1a2e] text-lg">
                  What's Next?
                </h3>
                <ul className="space-y-3 text-left max-w-xl mx-auto">
                  <li className="flex items-start gap-3">
                    <span className="text-[#d4af37] text-xl">✓</span>
                    <span>
                      You'll receive a confirmation email with your membership
                      details and receipt for tax purposes.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#d4af37] text-xl">✓</span>
                    <span>
                      Your membership card will be mailed to you within 2-3
                      weeks.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#d4af37] text-xl">✓</span>
                    <span>
                      Watch for invitations to exclusive member events and Guild
                      activities.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#d4af37] text-xl">✓</span>
                    <span>
                      Follow us on Facebook for updates about upcoming Symphony
                      performances and Guild news.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/"
                  className="bg-[#d4af37] text-[#1a1a2e] px-8 py-3 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors"
                >
                  Return to Home
                </a>
                <a
                  href="https://www.facebook.com/odessasymphonyguild/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-2 border-[#d4af37] text-[#d4af37] px-8 py-3 rounded-lg font-semibold hover:bg-[#d4af37] hover:text-[#1a1a2e] transition-colors"
                >
                  Follow Us on Facebook
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <JoinFormContent />
    </Suspense>
  );
}
