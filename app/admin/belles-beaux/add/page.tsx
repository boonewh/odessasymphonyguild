"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StudentForm from "@/components/admin/StudentForm";
import { AdminStudentSchema } from "@/lib/validation/student";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";

type PageState = "form" | "confirm" | "submitting" | "success";

export default function AdminAddStudent() {
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>("form");
  const [errorMessage, setErrorMessage] = useState("");
  const [draft, setDraft] = useState<AdminStudentSchema | null>(null);
  const [draftDues, setDraftDues] = useState<number | null>(null);
  const [result, setResult] = useState<{
    studentName: string;
    paymentLink: string | null;
    invoiceError: string | null;
    invoiceEmails: string[];
    invoiceRequested: boolean;
  } | null>(null);

  const draftEmails =
    draft?.guardians.map((g) => g.email?.trim()).filter((e): e is string => Boolean(e)) ?? [];

  // Valid form → show the invoice question instead of submitting immediately
  const onValidSubmit = (data: AdminStudentSchema, duesAmount: number | null) => {
    setDraft(data);
    setDraftDues(duesAmount);
    setErrorMessage("");
    setPageState("confirm");
  };

  const submitStudent = async (createInvoice: boolean) => {
    if (!draft) return;
    setPageState("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/students/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, createInvoice }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to add student. Please try again.");
      }

      setResult({
        studentName: `${draft.firstName} ${draft.lastName}`,
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
          {(pageState === "confirm" || pageState === "submitting") && draft && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-2">
                Create a QuickBooks invoice?
              </h2>
              <p className="text-sm text-gray-600 mb-1">
                Adding <span className="font-semibold">{draft.firstName} {draft.lastName}</span>
                {draftDues != null && <> &mdash; dues ${draftDues.toLocaleString()}</>}.
              </p>
              {draftEmails.length > 0 ? (
                <p className="text-sm text-gray-600 mb-6">
                  If you create an invoice, the payment link will be emailed to{" "}
                  <span className="text-[#d4af37]">{draftEmails.join(", ")}</span>.
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
                  disabled={pageState === "submitting" || draftEmails.length === 0}
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
            <StudentForm
              defaultValues={draft ?? undefined}
              submitLabel="Continue →"
              onValidSubmit={onValidSubmit}
            />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
