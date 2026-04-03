"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  studentFormSchema,
  StudentFormSchema,
  formatPhoneNumber,
} from "@/lib/validation/student";
import {
  BELLES_BEAUX_CONFIG,
  GRADE_OPTIONS,
  GENDER_OPTIONS,
  TSHIRT_SIZE_OPTIONS,
  DUES,
  LATE_FEE,
  getMembershipOptions,
  calculateDues,
} from "@/lib/belles-beaux/config";
import { MembershipType } from "@/types/student";

// ── Step configuration ────────────────────────────────────────────────────────
const STEPS = [
  { number: 1, label: "Student Info" },
  { number: 2, label: "Mom / Guardian" },
  { number: 3, label: "Dad / Guardian" },
  { number: 4, label: "Membership" },
];

type SubmitState = "idle" | "submitting" | "redirecting" | "error";

// ── Shared input styles ───────────────────────────────────────────────────────
const inputClass =
  "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-colors text-sm";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
const errorClass = "mt-1 text-xs text-red-600";

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step.number < current
                  ? "bg-[#d4af37] text-[#1a1a2e]"
                  : step.number === current
                  ? "bg-[#1a1a2e] text-[#d4af37] ring-2 ring-[#d4af37]"
                  : "bg-gray-200 text-gray-400"
              }`}
            >
              {step.number < current ? "✓" : step.number}
            </div>
            <span
              className={`text-xs mt-1.5 hidden sm:block ${
                step.number === current
                  ? "text-[#1a1a2e] font-semibold"
                  : "text-gray-400"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-16 sm:w-20 h-px mx-1 mb-5 ${
                step.number < current ? "bg-[#d4af37]" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-6">
      <h2 className="text-xl font-semibold text-[#1a1a2e] mb-1 flex items-center gap-3">
        <span className="text-[#d4af37] text-2xl font-light">/</span>
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-gray-400 mb-6 ml-7 italic">{subtitle}</p>
      )}
      <div className="mt-6">{children}</div>
    </div>
  );
}

// ── Parent / Guardian form section ────────────────────────────────────────────
function ParentSection({
  prefix,
  register,
  errors,
  watch,
  setValue,
}: {
  prefix: "mom" | "dad";
  register: ReturnType<typeof useForm<StudentFormSchema>>["register"];
  errors: ReturnType<typeof useForm<StudentFormSchema>>["formState"]["errors"];
  watch: ReturnType<typeof useForm<StudentFormSchema>>["watch"];
  setValue: ReturnType<typeof useForm<StudentFormSchema>>["setValue"];
}) {
  const parentErrors = errors[prefix];
  const cellKey = `${prefix}.cellNumber` as const;
  const cellValue = watch(cellKey);

  useEffect(() => {
    if (cellValue) {
      const formatted = formatPhoneNumber(cellValue);
      if (formatted !== cellValue) {
        setValue(cellKey, formatted);
      }
    }
  }, [cellValue, setValue, cellKey]);

  const formalNamePlaceholder =
    prefix === "mom"
      ? "e.g. Mr. and Mrs. John Smith  |  Ms. Jane Smith  |  Dr. Jane Smith"
      : "e.g. Mr. and Mrs. John Smith  |  Mr. John Smith  |  Dr. John Smith";

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>Name</label>
        <input type="text" {...register(`${prefix}.name`)} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Mailing Address</label>
        <input type="text" {...register(`${prefix}.mailingAddress`)} className={inputClass} />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <label className={labelClass}>City</label>
          <input type="text" {...register(`${prefix}.city`)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>State</label>
          <input
            type="text"
            {...register(`${prefix}.state`)}
            placeholder="TX"
            maxLength={2}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Zip Code</label>
          <input type="text" {...register(`${prefix}.zipCode`)} className={inputClass} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Cell Number</label>
          <input
            type="tel"
            {...register(`${prefix}.cellNumber`)}
            placeholder="(xxx) xxx-xxxx"
            className={inputClass}
          />
          {parentErrors?.cellNumber && (
            <p className={errorClass}>{parentErrors.cellNumber.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>
            E-mail Address{" "}
            <span className="text-[#d4af37] font-normal text-xs">(invoice delivered here)</span>
          </label>
          <input
            type="email"
            {...register(`${prefix}.email`)}
            className={inputClass}
            autoComplete="email"
          />
          {parentErrors?.email && (
            <p className={errorClass}>{parentErrors.email.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>
          Formal Name for Presentation
          <span className="block text-xs text-gray-400 font-normal mt-0.5">
            Used when your student is presented at the Gala
          </span>
        </label>
        <input
          type="text"
          {...register(`${prefix}.formalName`)}
          placeholder={formalNamePlaceholder}
          className={inputClass}
        />
      </div>
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
export default function JoinBellesBeaux() {
  const [step, setStep] = useState(1);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<StudentFormSchema>({
    resolver: zodResolver(studentFormSchema),
    mode: "onTouched",
  });

  const grade = watch("grade");
  const membershipType = watch("membershipType") as MembershipType | undefined;

  // Auto-format student cell
  const studentCell = watch("cellNumber");
  useEffect(() => {
    if (studentCell) {
      const formatted = formatPhoneNumber(studentCell);
      if (formatted !== studentCell) setValue("cellNumber", formatted);
    }
  }, [studentCell, setValue]);

  // When grade is set to 9, auto-assign freshman membership type
  useEffect(() => {
    if (grade === "9") {
      setValue("membershipType", "freshman");
    } else if (grade && membershipType === "freshman") {
      // Clear auto-set freshman type if user switches away from grade 9
      setValue("membershipType", "" as MembershipType);
    }
  }, [grade, setValue, membershipType]);

  // ── Step navigation ──────────────────────────────────────────────────────────
  const handleNext = async () => {
    if (step === 1) {
      const valid = await trigger([
        "firstName",
        "lastName",
        "cellNumber",
        "school",
        "grade",
        "gender",
        "tshirtSize",
      ]);
      if (valid) setStep(2);
    } else if (step === 2 || step === 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => setStep((s) => s - 1);

  // ── Final submit ─────────────────────────────────────────────────────────────
  const onSubmit = async (data: StudentFormSchema) => {
    setSubmitState("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/belles-beaux/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Submission failed. Please try again.");
      }

      if (result.paymentLink) {
        setSubmitState("redirecting");
        window.location.href = result.paymentLink;
      } else {
        setSubmitState("redirecting");
        setTimeout(() => {
          window.location.href = "/belles-beaux/join/confirmation";
        }, 1000);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setSubmitState("error");
    }
  };

  // ── Derived pricing display ──────────────────────────────────────────────────
  const duesAmount = membershipType ? calculateDues(membershipType) : null;
  const membershipOptions = getMembershipOptions(grade);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] py-14 text-center text-white">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-[#d4af37] text-xs tracking-[0.3em] uppercase mb-3">
            Odessa Symphony Guild
          </p>
          <h1 className="text-4xl sm:text-5xl font-light tracking-wide mb-4">
            Join Belles &amp; Beaux
          </h1>
          <div className="h-px w-20 bg-[#d4af37] mx-auto mb-4" />
          <p className="text-sm opacity-70 font-light">
            {BELLES_BEAUX_CONFIG.schoolYear} Membership Application &mdash; Submit one form per student
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-14 bg-gray-50">
        <div className="max-w-2xl mx-auto px-6">
          <StepIndicator current={step} />

          {/* ── STEP 1: Student Info ── */}
          {step === 1 && (
            <>
              <Card
                title="Belles & Beaux Member Information"
                subtitle="Please complete all required fields marked with *"
              >
                <div className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        {...register("firstName")}
                        className={inputClass}
                        autoComplete="given-name"
                      />
                      {errors.firstName && (
                        <p className={errorClass}>{errors.firstName.message}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Middle Name</label>
                      <input type="text" {...register("middleName")} className={inputClass} />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        {...register("lastName")}
                        className={inputClass}
                        autoComplete="family-name"
                      />
                      {errors.lastName && (
                        <p className={errorClass}>{errors.lastName.message}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Nickname</label>
                      <input type="text" {...register("nickname")} className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>
                      Cell Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      {...register("cellNumber")}
                      placeholder="(xxx) xxx-xxxx"
                      className={inputClass}
                    />
                    {errors.cellNumber && (
                      <p className={errorClass}>{errors.cellNumber.message}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      School <span className="text-red-500">*</span>
                    </label>
                    <input type="text" {...register("school")} className={inputClass} />
                    {errors.school && (
                      <p className={errorClass}>{errors.school.message}</p>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>
                        Grade ({BELLES_BEAUX_CONFIG.schoolYear}){" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <select {...register("grade")} className={inputClass}>
                        <option value="">Select grade</option>
                        {GRADE_OPTIONS.map((g) => (
                          <option key={g.value} value={g.value}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                      {errors.grade && (
                        <p className={errorClass}>{errors.grade.message}</p>
                      )}
                    </div>

                    <div>
                      <label className={labelClass}>
                        Gender <span className="text-red-500">*</span>
                      </label>
                      <select {...register("gender")} className={inputClass}>
                        <option value="">Select</option>
                        {GENDER_OPTIONS.map((g) => (
                          <option key={g.value} value={g.value}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                      {errors.gender && (
                        <p className={errorClass}>{errors.gender.message}</p>
                      )}
                    </div>

                    <div>
                      <label className={labelClass}>
                        T-shirt Size <span className="text-red-500">*</span>
                      </label>
                      <select {...register("tshirtSize")} className={inputClass}>
                        <option value="">Select size</option>
                        {TSHIRT_SIZE_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      {errors.tshirtSize && (
                        <p className={errorClass}>{errors.tshirtSize.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-[#d4af37] text-[#1a1a2e] px-8 py-3 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors"
                >
                  Continue to Parent Info →
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: Mom ── */}
          {step === 2 && (
            <>
              <Card
                title="Parent / Guardian Information — Mom"
                subtitle="If not applicable, click Skip below. At least one parent email is required."
              >
                <ParentSection
                  prefix="mom"
                  register={register}
                  errors={errors}
                  watch={watch}
                  setValue={setValue}
                />
              </Card>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-600 rounded-lg font-semibold hover:border-gray-400 transition-colors"
                >
                  ← Back
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-600 rounded-lg font-semibold hover:border-gray-400 transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="bg-[#d4af37] text-[#1a1a2e] px-8 py-3 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── STEP 3: Dad ── */}
          {step === 3 && (
            <>
              <Card
                title="Parent / Guardian Information — Dad"
                subtitle="If not applicable, click Skip below. At least one parent email is required."
              >
                <ParentSection
                  prefix="dad"
                  register={register}
                  errors={errors}
                  watch={watch}
                  setValue={setValue}
                />
              </Card>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-600 rounded-lg font-semibold hover:border-gray-400 transition-colors"
                >
                  ← Back
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-600 rounded-lg font-semibold hover:border-gray-400 transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="bg-[#d4af37] text-[#1a1a2e] px-8 py-3 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── STEP 4: Membership & Payment ── */}
          {step === 4 && (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* What's included */}
              <Card title="Financial Obligations">
                <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                  <p>
                    Annual dues and fees for all new freshman and returning Belles and Beaux are{" "}
                    <span className="font-semibold text-[#1a1a2e]">
                      ${DUES.freshman.toLocaleString()}.00
                    </span>{" "}
                    for the {BELLES_BEAUX_CONFIG.schoolYear} year.
                  </p>
                  <p>
                    Payment is due by <strong>June 30, 2026</strong>. A{" "}
                    <span className="font-semibold text-red-600">
                      ${LATE_FEE} late fee
                    </span>{" "}
                    will be added to any balance not paid by that date.
                  </p>
                  <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
                    Annual dues include parent membership, Belle/Beau membership, one student Ball
                    ticket, one raffle ticket, one OSG T-shirt, and the West Texas Symphony ticket
                    fund.
                  </p>
                </div>
              </Card>

              {/* Non-freshman buy-in info */}
              {grade !== "9" && (
                <Card title="First-Time Member Buy-In">
                  <div className="text-sm text-gray-600 space-y-3 leading-relaxed">
                    <p>
                      If your student is joining OSG for the first time and is not a freshman, a
                      buy-in fee is required in addition to the ${DUES.returning} annual dues.
                    </p>
                    <ul className="space-y-1 text-[#1a1a2e] font-medium border-l-2 border-[#d4af37] pl-4">
                      <li>First-time Sophomore — ${DUES.new_sophomore.toLocaleString()}</li>
                      <li>First-time Junior — ${DUES.new_junior.toLocaleString()}</li>
                      <li>First-time Senior — ${DUES.new_senior.toLocaleString()}</li>
                    </ul>
                  </div>
                </Card>
              )}

              {/* Membership type selection */}
              <Card title="Select Your Membership">
                {grade === "9" ? (
                  <div className="bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-lg p-4 text-sm text-[#1a1a2e]">
                    <p className="font-semibold">New Freshman — ${DUES.freshman.toLocaleString()}.00</p>
                    <p className="text-gray-500 text-xs mt-1">
                      All freshmen are enrolled at the standard annual rate.
                    </p>
                    <input type="hidden" {...register("membershipType")} value="freshman" />
                  </div>
                ) : membershipOptions ? (
                  <div className="space-y-3">
                    {membershipOptions.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors hover:border-[#d4af37]/50 has-[:checked]:border-[#d4af37] has-[:checked]:bg-[#d4af37]/5"
                      >
                        <input
                          type="radio"
                          value={opt.value}
                          {...register("membershipType")}
                          className="mt-0.5 accent-[#d4af37]"
                        />
                        <span className="text-sm font-medium text-[#1a1a2e]">{opt.label}</span>
                      </label>
                    ))}
                    {errors.membershipType && (
                      <p className={errorClass}>{errors.membershipType.message}</p>
                    )}
                  </div>
                ) : null}
              </Card>

              {/* Total due */}
              {duesAmount !== null && (
                <div className="bg-[#1a1a2e] text-white rounded-xl p-6 mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#d4af37] tracking-wider uppercase">Total Due</p>
                    <p className="text-3xl font-light mt-1">
                      ${duesAmount.toLocaleString()}.00
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-400 max-w-[200px]">
                    You will be redirected to a secure QuickBooks payment page. An invoice will
                    also be sent to the parent email(s) provided.
                    <p className="mt-2 text-gray-500">
                      Payment services provided by Intuit Payments Inc.
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {submitState === "error" && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitState === "submitting" || submitState === "redirecting"}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-600 rounded-lg font-semibold hover:border-gray-400 transition-colors disabled:opacity-50"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={submitState === "submitting" || submitState === "redirecting"}
                  className="bg-[#d4af37] text-[#1a1a2e] px-10 py-3 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitState === "submitting"
                    ? "Submitting..."
                    : submitState === "redirecting"
                    ? "Redirecting to payment..."
                    : "Submit & Proceed to Payment"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
