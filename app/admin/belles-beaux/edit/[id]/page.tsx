"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StudentForm, { emptyGuardian } from "@/components/admin/StudentForm";
import { AdminStudentSchema, GUARDIAN_RELATIONSHIPS } from "@/lib/validation/student";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";

// DB row → form values. Guardian columns are flat (guardian_1_name, ...) so
// an index signature covers the dynamic access.
interface StudentApiRow {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  nickname: string | null;
  cell_number: string;
  school: string;
  grade: string;
  gender: string;
  tshirt_size: string;
  membership_type: string;
  [key: string]: string | number | boolean | null;
}

function rowToFormValues(row: StudentApiRow): AdminStudentSchema {
  const guardians: AdminStudentSchema["guardians"] = [];
  for (let n = 1; n <= 4; n++) {
    const get = (col: string) => (row[`guardian_${n}_${col}`] as string | null) ?? "";
    const guardian = {
      relationship:   get("relationship") as (typeof GUARDIAN_RELATIONSHIPS)[number],
      name:           get("name"),
      mailingAddress: get("address"),
      city:           get("city"),
      state:          get("state"),
      zipCode:        get("zip"),
      cellNumber:     get("cell"),
      email:          get("email"),
      formalName:     get("formal_name"),
    };
    if (Object.values(guardian).some(Boolean)) guardians.push(guardian);
  }
  if (guardians.length === 0) guardians.push(emptyGuardian);

  return {
    firstName:      row.first_name,
    middleName:     row.middle_name ?? "",
    lastName:       row.last_name,
    nickname:       row.nickname ?? "",
    cellNumber:     row.cell_number,
    school:         row.school,
    grade:          row.grade as AdminStudentSchema["grade"],
    gender:         row.gender,
    tshirtSize:     row.tshirt_size,
    membershipType: row.membership_type as AdminStudentSchema["membershipType"],
    guardians,
  };
}

export default function AdminEditStudent() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState("");
  const [defaults, setDefaults]       = useState<AdminStudentSchema | null>(null);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState("");
  const [savedWarning, setSavedWarning] = useState<string | null>(null);
  const [saved, setSaved]             = useState(false);

  useEffect(() => {
    async function fetchStudent() {
      try {
        const res = await fetch(`/api/admin/students/${id}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        setDefaults(rowToFormValues(json.student));
      } catch {
        setLoadError("Failed to load this student. They may have been deleted.");
      }
      setLoading(false);
    }
    fetchStudent();
  }, [id]);

  const handleSave = async (data: AdminStudentSchema) => {
    setSaving(true);
    setSaveError("");

    try {
      const res = await fetch(`/api/admin/students/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to save changes. Please try again.");
      }

      setSavedWarning(json.invoiceWarning ?? null);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "An unexpected error occurred.");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] py-12 text-white">
        <div className="max-w-3xl mx-auto px-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-wide mb-1">Edit Student</h1>
            <p className="text-[#d4af37] text-sm tracking-wider">
              {BELLES_BEAUX_CONFIG.schoolYear} Season &mdash;{" "}
              {defaults ? `${defaults.firstName} ${defaults.lastName}` : "Loading..."}
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

          {loading && (
            <div className="text-center py-16 text-gray-400">Loading student...</div>
          )}

          {loadError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {loadError}
            </div>
          )}

          {/* ── Saved ── */}
          {saved && defaults && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <p className="text-3xl mb-3">✓</p>
              <h2 className="text-xl font-semibold text-[#1a1a2e] mb-2">Changes saved</h2>
              {savedWarning && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2 text-left">
                  {savedWarning}
                </p>
              )}
              <div className="flex justify-center gap-3 mt-6">
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-2.5 border-2 border-gray-300 text-gray-600 rounded-lg font-semibold hover:border-gray-400 transition-colors text-sm"
                >
                  Keep Editing
                </button>
                <button
                  onClick={() => router.push("/admin/belles-beaux")}
                  className="bg-[#d4af37] text-[#1a1a2e] px-6 py-2.5 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors text-sm"
                >
                  Back to Roster
                </button>
              </div>
            </div>
          )}

          {/* ── Form ── */}
          {!loading && !loadError && !saved && defaults && (
            <>
              {saveError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {saveError}
                </div>
              )}
              <StudentForm
                defaultValues={defaults}
                submitLabel="Save Changes"
                busy={saving}
                onValidSubmit={handleSave}
              />
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
