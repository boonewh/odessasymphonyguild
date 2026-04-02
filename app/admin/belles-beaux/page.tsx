"use client";

import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";
import { createClient } from "@/utils/supabase/client";

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
  mom_name: string | null;
  mom_email: string | null;
  mom_cell: string | null;
  mom_formal_name: string | null;
  dad_name: string | null;
  dad_email: string | null;
  dad_cell: string | null;
  dad_formal_name: string | null;
  paid: boolean;
  paid_at: string | null;
  qb_invoice_id: string | null;
}

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "osg2026";

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
  const [authed, setAuthed]           = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const [students, setStudents]       = useState<StudentRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [fetchError, setFetchError]   = useState("");

  const [search, setSearch]           = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [paidFilter, setPaidFilter]   = useState("all");

  // Load students once authenticated
  useEffect(() => {
    if (!authed) return;

    async function fetchStudents() {
      setLoading(true);
      setFetchError("");

      const supabase = createClient();
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("school_year", BELLES_BEAUX_CONFIG.schoolYear)
        .order("last_name", { ascending: true });

      if (error) {
        setFetchError("Failed to load student data. Please refresh.");
      } else {
        setStudents(data as StudentRow[]);
      }
      setLoading(false);
    }

    fetchStudents();
  }, [authed]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthed(true);
    } else {
      setPasswordError(true);
      setPasswordInput("");
    }
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

  // ── Login gate ────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-10 w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-[#1a1a2e]">Admin Access</h1>
            <p className="text-sm text-gray-500 mt-1">Belles &amp; Beaux Roster</p>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
              placeholder="Enter password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent mb-3"
            />
            {passwordError && (
              <p className="text-sm text-red-600 mb-3">Incorrect password.</p>
            )}
            <button
              type="submit"
              className="w-full bg-[#d4af37] text-[#1a1a2e] py-3 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Roster ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] py-12 text-white">
        <div className="max-w-7xl mx-auto px-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-wide mb-1">
              Belles &amp; Beaux Roster
            </h1>
            <p className="text-[#d4af37] text-sm tracking-wider">
              {BELLES_BEAUX_CONFIG.schoolYear} Season &mdash; Admin View
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-white/50 hover:text-white transition-colors print:hidden"
          >
            ↻ Refresh
          </button>
        </div>
      </section>

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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-gray-400">
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
                          <td className="px-5 py-4 text-xs text-gray-600 space-y-0.5">
                            {s.mom_name && <p>{s.mom_name}</p>}
                            {s.mom_email && (
                              <p className="text-[#d4af37]">{s.mom_email}</p>
                            )}
                            {s.dad_name && <p className="mt-1">{s.dad_name}</p>}
                            {s.dad_email && (
                              <p className="text-[#d4af37]">{s.dad_email}</p>
                            )}
                          </td>
                          <td className="px-5 py-4 font-medium text-[#1a1a2e]">
                            ${s.dues_amount.toLocaleString()}
                          </td>
                          <td className="px-5 py-4">
                            {s.paid ? (
                              <div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                  Paid
                                </span>
                                {s.paid_at && (
                                  <p className="text-xs text-gray-400 mt-1">{formatDate(s.paid_at)}</p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                                  Pending
                                </span>
                                <p className="text-xs text-gray-400 mt-1">
                                  {formatDate(s.submitted_at)}
                                </p>
                              </div>
                            )}
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

      {/* Print-only header */}
      <div className="hidden print:block fixed top-0 left-0 w-full p-4 text-center border-b">
        <h1 className="text-xl font-bold">
          OSG Belles &amp; Beaux — {BELLES_BEAUX_CONFIG.schoolYear} Roster
        </h1>
        <p className="text-sm text-gray-500">Printed {new Date().toLocaleDateString()}</p>
      </div>

      <Footer />
    </div>
  );
}
