"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";

// ── Types matching the Supabase table columns ─────────────────────────────────
interface StudentRow {
  id: string;
  school_year: string;
  submitted_at: string;
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
  dues_amount: number;
  // Guardian columns (new)
  guardian_1_relationship: string | null;
  guardian_1_name: string | null;
  guardian_1_email: string | null;
  guardian_1_cell: string | null;
  guardian_2_relationship: string | null;
  guardian_2_name: string | null;
  guardian_2_email: string | null;
  guardian_2_cell: string | null;
  guardian_3_relationship: string | null;
  guardian_3_name: string | null;
  guardian_3_email: string | null;
  guardian_3_cell: string | null;
  guardian_4_relationship: string | null;
  guardian_4_name: string | null;
  guardian_4_email: string | null;
  guardian_4_cell: string | null;
  // Legacy columns for historical records
  mom_name: string | null;
  mom_email: string | null;
  dad_name: string | null;
  dad_email: string | null;
  paid: boolean;
  paid_at: string | null;
  qb_invoice_id: string | null;
  late_fee_applied: boolean;
  late_fee_amount: number | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function membershipLabel(type: string) {
  const map: Record<string, string> = {
    freshman:      "Freshman",
    returning:     "Returning",
    new_sophomore: "New Soph",
    new_junior:    "New Junior",
    new_senior:    "New Senior",
  };
  return map[type] ?? type;
}

export default function AdminBellesBeaux() {
  const router = useRouter();

  const [students, setStudents]     = useState<StudentRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [toggling, setToggling]     = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feeBusyId, setFeeBusyId]   = useState<string | null>(null);
  const [lateFee, setLateFee]       = useState<number | null>(null);

  const [search, setSearch]           = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [paidFilter, setPaidFilter]   = useState("all");

  // Load students on mount — middleware guarantees we're authenticated
  useEffect(() => {
    async function fetchStudents() {
      setLoading(true);
      setFetchError("");

      try {
        const res = await fetch("/api/admin/students");
        if (!res.ok) throw new Error();
        const json = await res.json();
        setStudents(json.students as StudentRow[]);
      } catch {
        setFetchError("Failed to load student data. Please refresh.");
      }
      setLoading(false);
    }

    fetchStudents();

    // Current late fee amount, for the confirm prompt
    fetch("/api/belles-beaux/pricing")
      .then((res) => res.json())
      .then((data) => typeof data.lateFee === "number" && setLateFee(data.lateFee))
      .catch(() => {});
  }, []);

  const handleTogglePaid = async (student: StudentRow) => {
    if (toggling.has(student.id)) return;
    setToggling((prev) => new Set(prev).add(student.id));

    const newPaid = !student.paid;
    const res = await fetch(`/api/admin/students/${student.id}/mark-paid`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ paid: newPaid }),
    });

    if (res.ok) {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? { ...s, paid: newPaid, paid_at: newPaid ? new Date().toISOString() : null }
            : s
        )
      );
    }

    setToggling((prev) => {
      const next = new Set(prev);
      next.delete(student.id);
      return next;
    });
  };

  const handleLateFee = async (student: StudentRow) => {
    if (feeBusyId) return;

    const apply = !student.late_fee_applied;
    const feeLabel = apply
      ? lateFee != null ? `$${lateFee.toLocaleString()}` : "the late fee"
      : `$${(student.late_fee_amount ?? 0).toLocaleString()}`;
    const confirmed = window.confirm(
      apply
        ? `Add the ${feeLabel} late fee to ${student.first_name} ${student.last_name}'s dues?\n\n` +
          `Their QuickBooks invoice will be updated to include it.`
        : `Remove the ${feeLabel} late fee from ${student.first_name} ${student.last_name}'s dues?\n\n` +
          `The late fee line will be removed from their QuickBooks invoice.`
    );
    if (!confirmed) return;

    setFeeBusyId(student.id);
    const res = await fetch(`/api/admin/students/${student.id}/late-fee`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ apply }),
    });

    if (res.ok) {
      const json = await res.json();
      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? {
                ...s,
                dues_amount:      json.duesAmount,
                late_fee_applied: json.lateFeeApplied,
                late_fee_amount:  json.lateFeeAmount,
              }
            : s
        )
      );
      if (json.invoiceWarning) window.alert(json.invoiceWarning);
    } else {
      const json = await res.json().catch(() => null);
      window.alert(json?.error ?? "Failed to update the late fee. Please try again.");
    }
    setFeeBusyId(null);
  };

  const handleDelete = async (student: StudentRow) => {
    if (deletingId) return;

    const confirmed = window.confirm(
      `Delete ${student.first_name} ${student.last_name} from the roster?\n\n` +
      `This permanently removes their application. If a QuickBooks invoice ` +
      `was created for them, it must be voided in QuickBooks separately.`
    );
    if (!confirmed) return;

    setDeletingId(student.id);
    const res = await fetch(`/api/admin/students/${student.id}`, { method: "DELETE" });

    if (res.ok) {
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
    } else {
      window.alert("Failed to delete student. Please try again.");
    }
    setDeletingId(null);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const searchable = `${s.first_name} ${s.last_name} ${s.nickname ?? ""} ${s.school}`.toLowerCase();
      const matchesSearch  = !search || searchable.includes(search.toLowerCase());
      const matchesGrade   = gradeFilter === "all" || s.grade === gradeFilter;
      const matchesPaid    =
        paidFilter === "all" ||
        (paidFilter === "paid"   && s.paid) ||
        (paidFilter === "unpaid" && !s.paid);
      return matchesSearch && matchesGrade && matchesPaid;
    });
  }, [students, search, gradeFilter, paidFilter]);

  const paidCount   = students.filter((s) => s.paid).length;
  const unpaidCount = students.length - paidCount;

  // ── Roster ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          @page { margin: 0.4in; size: landscape; }
          table { font-size: 9px; width: 100%; }
          td, th { padding: 3px 6px !important; }
        }
      `}</style>
      <div className="print:hidden"><Header /></div>

      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] py-12 text-white print:hidden">
        <div className="max-w-7xl mx-auto px-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-wide mb-1">
              Belles &amp; Beaux Roster
            </h1>
            <p className="text-[#d4af37] text-sm tracking-wider">
              {BELLES_BEAUX_CONFIG.schoolYear} Season &mdash; Admin View
            </p>
          </div>
          <div className="flex items-center gap-4 print:hidden">
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              ↻ Refresh
            </button>
            <button
              onClick={() => router.push("/admin/belles-beaux/add")}
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              + Add Student
            </button>
            <button
              onClick={() => router.push("/admin/pricing")}
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              Pricing
            </button>
            <button
              onClick={handleLogout}
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </section>

      {/* Print-only header — flows naturally before content, no overlap */}
      <div className="hidden print:block p-4 text-center border-b mb-4">
        <h1 className="text-xl font-bold">
          OSG Belles &amp; Beaux — {BELLES_BEAUX_CONFIG.schoolYear} Roster
        </h1>
        <p className="text-sm text-gray-500">Printed {new Date().toLocaleDateString()}</p>
      </div>

      <section className="py-10">
        <div className="max-w-7xl mx-auto px-6">

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
              <p className="text-3xl font-semibold text-[#1a1a2e]">{students.length}</p>
              <p className="text-sm text-gray-500 mt-1">Total Registered</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
              <p className="text-3xl font-semibold text-green-600">{paidCount}</p>
              <p className="text-sm text-gray-500 mt-1">Dues Paid</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
              <p className="text-3xl font-semibold text-amber-500">{unpaidCount}</p>
              <p className="text-sm text-gray-500 mt-1">Payment Pending</p>
            </div>
          </div>

          {/* Filters & Print */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center justify-between print:hidden">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <input
                type="text"
                placeholder="Search by name or school..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent text-sm w-full sm:w-64"
              />
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Grades</option>
                <option value="9">9th Grade</option>
                <option value="10">10th Grade</option>
                <option value="11">11th Grade</option>
                <option value="12">12th Grade</option>
              </select>
              <select
                value={paidFilter}
                onChange={(e) => setPaidFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Pending</option>
              </select>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-2.5 border-2 border-[#d4af37] text-[#d4af37] rounded-lg font-semibold hover:bg-[#d4af37] hover:text-[#1a1a2e] transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Roster
            </button>
          </div>

          {/* Loading / Error states */}
          {loading && (
            <div className="text-center py-16 text-gray-400">Loading students...</div>
          )}
          {fetchError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-6">
              {fetchError}
            </div>
          )}

          {/* Roster Table */}
          {!loading && !fetchError && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1a1a2e] text-white">
                      <th className="text-left px-5 py-3.5 font-medium tracking-wider text-xs uppercase">Name</th>
                      <th className="text-left px-5 py-3.5 font-medium tracking-wider text-xs uppercase">School</th>
                      <th className="text-left px-5 py-3.5 font-medium tracking-wider text-xs uppercase">Grade</th>
                      <th className="text-left px-5 py-3.5 font-medium tracking-wider text-xs uppercase">Membership</th>
                      <th className="text-left px-5 py-3.5 font-medium tracking-wider text-xs uppercase">Parent Contact</th>
                      <th className="text-left px-5 py-3.5 font-medium tracking-wider text-xs uppercase">Dues</th>
                      <th className="text-left px-5 py-3.5 font-medium tracking-wider text-xs uppercase">Status</th>
                      <th className="text-left px-5 py-3.5 font-medium tracking-wider text-xs uppercase print:hidden">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-16 text-gray-400">
                          {students.length === 0
                            ? "No students have registered yet."
                            : "No students match your search."}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-medium text-[#1a1a2e]">
                              {s.last_name}, {s.first_name}
                              {s.nickname ? ` "${s.nickname}"` : ""}
                            </p>
                            {s.middle_name && (
                              <p className="text-xs text-gray-400">{s.middle_name}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">{s.cell_number}</p>
                          </td>
                          <td className="px-5 py-4 text-gray-600">{s.school}</td>
                          <td className="px-5 py-4 text-gray-600">{s.grade}th</td>
                          <td className="px-5 py-4 text-gray-600 text-xs">
                            {membershipLabel(s.membership_type)}
                          </td>
                          <td className="px-5 py-4 text-xs text-gray-600 space-y-1">
                            {([1, 2, 3, 4] as const).map((n) => {
                              const name  = s[`guardian_${n}_name` as keyof StudentRow] as string | null;
                              const email = s[`guardian_${n}_email` as keyof StudentRow] as string | null;
                              const rel   = s[`guardian_${n}_relationship` as keyof StudentRow] as string | null;
                              if (!name && !email) return null;
                              return (
                                <div key={n} className={n > 1 ? "pt-1 border-t border-gray-100" : ""}>
                                  {name && <p>{name}{rel ? <span className="text-gray-400"> ({rel})</span> : null}</p>}
                                  {email && <p className="text-[#d4af37]">{email}</p>}
                                </div>
                              );
                            })}
                            {/* Fallback for legacy mom/dad records */}
                            {!s.guardian_1_name && !s.guardian_1_email && (
                              <>
                                {s.mom_name && <p>{s.mom_name}</p>}
                                {s.mom_email && <p className="text-[#d4af37]">{s.mom_email}</p>}
                                {s.dad_name && <p className="mt-1">{s.dad_name}</p>}
                                {s.dad_email && <p className="text-[#d4af37]">{s.dad_email}</p>}
                              </>
                            )}
                          </td>
                          <td className="px-5 py-4 font-medium text-[#1a1a2e]">
                            ${s.dues_amount.toLocaleString()}
                            {s.late_fee_applied && (
                              <p className="text-xs font-normal text-amber-600">
                                incl. ${(s.late_fee_amount ?? 0).toLocaleString()} late fee
                              </p>
                            )}
                            {!s.paid && (
                              <button
                                onClick={() => handleLateFee(s)}
                                disabled={feeBusyId === s.id}
                                className="block mt-1 text-xs font-normal text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-50 print:hidden"
                              >
                                {feeBusyId === s.id
                                  ? "Updating..."
                                  : s.late_fee_applied
                                  ? "Remove late fee"
                                  : "+ Late fee"}
                              </button>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              onClick={() => handleTogglePaid(s)}
                              disabled={toggling.has(s.id)}
                              title={s.paid ? "Click to mark as unpaid" : "Click to mark as paid"}
                              className="text-left disabled:opacity-50 print:pointer-events-none"
                            >
                              {s.paid ? (
                                <div>
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold hover:bg-green-200 transition-colors">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                    Paid
                                  </span>
                                  {s.paid_at && (
                                    <p className="text-xs text-gray-400 mt-1">{formatDate(s.paid_at)}</p>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold hover:bg-amber-100 transition-colors">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                                    Pending
                                  </span>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {formatDate(s.submitted_at)}
                                  </p>
                                </div>
                              )}
                            </button>
                          </td>
                          <td className="px-5 py-4 print:hidden">
                            <button
                              onClick={() => handleDelete(s)}
                              disabled={deletingId === s.id}
                              title="Delete this student"
                              className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            >
                              {deletingId === s.id ? "Deleting..." : "Delete"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                Showing {filtered.length} of {students.length} students
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="print:hidden"><Footer /></div>
    </div>
  );
}
