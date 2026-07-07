"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  adminStudentSchema,
  AdminStudentSchema,
  formatPhoneNumber,
  GUARDIAN_RELATIONSHIPS,
} from "@/lib/validation/student";
import {
  BELLES_BEAUX_CONFIG,
  GRADE_OPTIONS,
  GENDER_OPTIONS,
  TSHIRT_SIZE_OPTIONS,
  DUES,
} from "@/lib/belles-beaux/config";
import { MembershipType } from "@/types/student";

type PageState = "form" | "confirm" | "submitting" | "success";

const inputClass =
  "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-colors text-sm";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
const errorClass = "mt-1 text-xs text-red-600";

const emptyGuardian = {
  relationship: "" as (typeof GUARDIAN_RELATIONSHIPS)[number],
  name: "",
  mailingAddress: "",
  city: "",
  state: "",
  zipCode: "",
  cellNumber: "",
  email: "",
  formalName: "",
};

export default function AdminAddStudent() {
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>("form");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<{
    studentName: string;
    paymentLink: string | null;
    invoiceError: string | null;
    invoiceEmails: string[];
    invoiceRequested: boolean;
  } | null>(null);

  // Live pricing from settings table (falls back to config defaults)
  const [liveDues, setLiveDues] = useState<typeof DUES>(DUES);
  useEffect(() => {
    fetch("/api/belles-beaux/pricing")
      .then((res) => res.json())
      .then((data) => data.dues && setLiveDues(data.dues))
      .catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<AdminStudentSchema>({
    resolver: zodResolver(adminStudentSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      nickname: "",
      cellNumber: "",
      school: "",
      grade: undefined,
      gender: "",
      tshirtSize: "",
      guardians: [emptyGuardian],
      membershipType: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "guardians" });

  const grade = watch("grade");
  const membershipType = watch("membershipType");
  const guardians = watch("guardians");

  // Grade 9 is always freshman — no membership choice
  useEffect(() => {
    if (grade === "9") setValue("membershipType", "freshman");
  }, [grade, setValue]);

  const membershipOptions = (() => {
    if (!grade || grade === "9") return null;
    const gradeLabel: Record<string, string> = { "10": "Sophomore", "11": "Junior", "12": "Senior" };
    const newType = `new_${gradeLabel[grade].toLowerCase()}` as MembershipType;
    return [
      { value: "returning", label: `Returning Member — $${liveDues.returning.toLocaleString()}` },
      { value: newType,     label: `First-Time ${gradeLabel[grade]} (New Member) — $${liveDues[newType].toLocaleString()}` },
    ];
  })();

  const duesAmount = membershipType ? liveDues[membershipType] : null;
  const firstGuardianEmail = guardians?.map((g) => g.email?.trim()).find(Boolean) ?? null;

  // Valid form → show the invoice question instead of submitting immediately
  const onValidated = () => {
    setErrorMessage("");
    setPageState("confirm");
  };

  const submitStudent = async (createInvoice: boolean) => {
    setPageState("submitting");
    setErrorMessage("");

    try {
      const data = getValues();
      const response = await fetch("/api/admin/students/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, createInvoice }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to add student. Please try again.");
      }

      setResult({
        studentName: `${data.firstName} ${data.lastName}`,
        paymentLink: json.paymentLink ?? null,
        invoiceError: json.invoiceError ?? null,
        invoiceEmails: json.invoiceEmails ?? [],
        invoiceRequested: createInvoice,
      });
      setPageState("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
      setPageState("confirm");
    }
  };

  const phoneField = (name: `cellNumber` | `guardians.${number}.cellNumber`) => ({
    ...register(name),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(name, formatPhoneNumber(e.target.value), { shouldValidate: false });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] py-12 text-white">
        <div className="max-w-3xl mx-auto px-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-wide mb-1">Add Student</h1>
            <p className="text-[#d4af37] text-sm tracking-wider">
              {BELLES_BEAUX_CONFIG.schoolYear} Season &mdash; Manual Entry
            </p>
          </div>
          <button
            onClick={() => router.push("/admin/belles-beaux")}
            className="text-xs text-white/50 hover:text-white transition-colors"
          >
            ← Back to Roster
          </button>
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-3xl mx-auto px-6">

          {/* ── Success ── */}
          {pageState === "success" && result && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <p className="text-3xl mb-3">✓</p>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-2">
                {result.studentName} has been added
              </h2>
              {result.invoiceRequested && !result.invoiceError && (
                <p className="text-sm text-gray-600 mb-2">
                  A QuickBooks invoice was created and the payment link was emailed to{" "}
                  <span className="text-[#d4af37]">{result.invoiceEmails.join(", ")}</span>.
                </p>
              )}
              {result.invoiceError && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                  {result.invoiceError}
                </p>
              )}
              {!result.invoiceRequested && (
                <p className="text-sm text-gray-600 mb-2">
                  No invoice was created. You can mark them paid from the roster once dues are collected.
                </p>
              )}
              {result.paymentLink && (
                <p className="text-xs text-gray-400 break-all mb-4">
                  Payment link: <a href={result.paymentLink} className="text-[#d4af37] underline">{result.paymentLink}</a>
                </p>
              )}
              <div className="flex justify-center gap-3 mt-6">
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-2.5 border-2 border-gray-300 text-gray-600 rounded-lg font-semibold hover:border-gray-400 transition-colors text-sm"
                >
                  Add Another
                </button>
                <button
                  onClick={() => router.push("/admin/belles-beaux")}
                  className="bg-[#d4af37] text-[#1a1a2e] px-6 py-2.5 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors text-sm"
                >
                  View Roster
                </button>
              </div>
            </div>
          )}

          {/* ── Invoice question ── */}
          {(pageState === "confirm" || pageState === "submitting") && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-2">
                Create a QuickBooks invoice?
              </h2>
              <p className="text-sm text-gray-600 mb-1">
                Adding <span className="font-semibold">{getValues("firstName")} {getValues("lastName")}</span>
                {duesAmount != null && <> &mdash; dues ${duesAmount.toLocaleString()}</>}.
              </p>
              {firstGuardianEmail ? (
                <p className="text-sm text-gray-600 mb-6">
                  If you create an invoice, the payment link will be emailed to{" "}
                  <span className="text-[#d4af37]">
                    {guardians.map((g) => g.email?.trim()).filter(Boolean).join(", ")}
                  </span>.
                </p>
              ) : (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                  No guardian email was entered, so an invoice cannot be sent. Go back and add an
                  email, or add the student without an invoice.
                </p>
              )}

              {errorMessage && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {errorMessage}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => submitStudent(true)}
                  disabled={pageState === "submitting" || !firstGuardianEmail}
                  className="bg-[#d4af37] text-[#1a1a2e] px-6 py-2.5 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pageState === "submitting" ? "Working..." : "Yes — Create Invoice & Email Link"}
                </button>
                <button
                  onClick={() => submitStudent(false)}
                  disabled={pageState === "submitting"}
                  className="px-6 py-2.5 border-2 border-gray-300 text-gray-600 rounded-lg font-semibold hover:border-gray-400 transition-colors text-sm disabled:opacity-50"
                >
                  No — Add Without Invoice
                </button>
                <button
                  onClick={() => setPageState("form")}
                  disabled={pageState === "submitting"}
                  className="px-6 py-2.5 text-gray-400 hover:text-gray-600 transition-colors text-sm disabled:opacity-50"
                >
                  ← Back to Edit
                </button>
              </div>
            </div>
          )}

          {/* ── Form ── */}
          {pageState === "form" && (
            <form onSubmit={handleSubmit(onValidated)} noValidate>
              {/* Student */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-6">
                <h2 className="text-lg font-semibold text-[#1a1a2e] mb-6">Student</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>First Name *</label>
                    <input type="text" {...register("firstName")} className={inputClass} />
                    {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Last Name *</label>
                    <input type="text" {...register("lastName")} className={inputClass} />
                    {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Middle Name</label>
                    <input type="text" {...register("middleName")} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Nickname</label>
                    <input type="text" {...register("nickname")} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Student Cell *</label>
                    <input type="tel" placeholder="(432) 555-1234" {...phoneField("cellNumber")} className={inputClass} />
                    {errors.cellNumber && <p className={errorClass}>{errors.cellNumber.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>School *</label>
                    <input type="text" {...register("school")} className={inputClass} />
                    {errors.school && <p className={errorClass}>{errors.school.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Grade *</label>
                    <select {...register("grade")} className={inputClass}>
                      <option value="">Select grade...</option>
                      {GRADE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {errors.grade && <p className={errorClass}>{errors.grade.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Gender *</label>
                    <select {...register("gender")} className={inputClass}>
                      <option value="">Select...</option>
                      {GENDER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {errors.gender && <p className={errorClass}>{errors.gender.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>T-Shirt Size *</label>
                    <select {...register("tshirtSize")} className={inputClass}>
                      <option value="">Select size...</option>
                      {TSHIRT_SIZE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {errors.tshirtSize && <p className={errorClass}>{errors.tshirtSize.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Membership *</label>
                    {grade === "9" ? (
                      <p className="px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 text-sm">
                        New Freshman — ${liveDues.freshman.toLocaleString()}
                      </p>
                    ) : membershipOptions ? (
                      <select {...register("membershipType")} className={inputClass}>
                        <option value="">Select membership...</option>
                        {membershipOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-400 text-sm">
                        Select a grade first
                      </p>
                    )}
                    {errors.membershipType && <p className={errorClass}>{errors.membershipType.message}</p>}
                  </div>
                </div>
              </div>

              {/* Guardians */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-6">
                <h2 className="text-lg font-semibold text-[#1a1a2e] mb-1">Guardians</h2>
                <p className="text-sm text-gray-400 mb-6">
                  At least one guardian is required. A guardian email is needed to send an invoice.
                </p>
                {fields.map((field, index) => {
                  const gErrors = errors.guardians?.[index];
                  return (
                    <div key={field.id} className={index > 0 ? "mt-6 pt-6 border-t border-gray-100" : ""}>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-gray-500">Guardian {index + 1}</p>
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Relationship *</label>
                          <select {...register(`guardians.${index}.relationship`)} className={inputClass}>
                            <option value="">Select...</option>
                            {GUARDIAN_RELATIONSHIPS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          {gErrors?.relationship && <p className={errorClass}>{gErrors.relationship.message}</p>}
                        </div>
                        <div>
                          <label className={labelClass}>Name</label>
                          <input type="text" {...register(`guardians.${index}.name`)} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Email</label>
                          <input type="email" {...register(`guardians.${index}.email`)} className={inputClass} />
                          {gErrors?.email && <p className={errorClass}>{gErrors.email.message}</p>}
                        </div>
                        <div>
                          <label className={labelClass}>Cell</label>
                          <input type="tel" placeholder="(432) 555-1234" {...phoneField(`guardians.${index}.cellNumber`)} className={inputClass} />
                          {gErrors?.cellNumber && <p className={errorClass}>{gErrors.cellNumber.message}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {fields.length < 4 && (
                  <button
                    type="button"
                    onClick={() => append(emptyGuardian)}
                    className="mt-6 text-sm font-semibold text-[#d4af37] hover:text-[#c19b2e] transition-colors"
                  >
                    + Add Another Guardian
                  </button>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-[#d4af37] text-[#1a1a2e] px-10 py-3 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors"
                >
                  Continue →
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
