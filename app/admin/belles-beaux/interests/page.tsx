"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";

interface InterestRow {
  id: string;
  submitted_at: string;
  interest_year: string;
  student_name: string;
  parent_name: string;
  school: string;
  parent_email: string;
  parent_phone: string;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BellesBeauxInterests() {
  const router = useRouter();
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/interests")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => setInterests(data.interests as InterestRow[]))
      .catch(() => setError("The interest list could not be loaded. Please refresh and try again."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return interests;
    return interests.filter((row) =>
      [row.student_name, row.parent_name, row.school, row.parent_email, row.parent_phone]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [interests, search]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] py-12 text-white">
        <div className="mx-auto flex max-w-7xl items-end justify-between gap-6 px-6">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[#d4af37]">Belles &amp; Beaux</p>
            <h1 className="text-3xl font-light tracking-wide">Next-Season Interest List</h1>
            <p className="mt-2 text-sm text-white/55">Prospective families for {BELLES_BEAUX_CONFIG.nextSchoolYear}</p>
          </div>
          <button
            onClick={() => router.push("/admin/belles-beaux")}
            className="text-sm text-white/60 transition-colors hover:text-white"
          >
            ← Back to Roster
          </button>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="border-l-2 border-[#d4af37] pl-4">
            <p className="text-3xl font-semibold text-[#1a1a2e]">{interests.length}</p>
            <p className="text-sm text-gray-500">Interested {interests.length === 1 ? "family" : "families"}</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search names, school, email, or phone..."
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#d4af37] sm:w-96"
          />
        </div>

        {loading && <div className="py-20 text-center text-gray-400">Loading interest list...</div>}
        {error && <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && !error && (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1a1a2e] text-left text-xs uppercase tracking-wider text-white">
                    <th className="px-5 py-3.5 font-medium">Student</th>
                    <th className="px-5 py-3.5 font-medium">School</th>
                    <th className="px-5 py-3.5 font-medium">Parent / Guardian</th>
                    <th className="px-5 py-3.5 font-medium">Email</th>
                    <th className="px-5 py-3.5 font-medium">Phone</th>
                    <th className="px-5 py-3.5 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                        {interests.length === 0 ? "No families have joined the interest list yet." : "No entries match your search."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-[#d4af37]/[0.04]">
                        <td className="whitespace-nowrap px-5 py-4 font-medium text-[#1a1a2e]">{row.student_name}</td>
                        <td className="px-5 py-4 text-gray-600">{row.school}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-gray-600">{row.parent_name}</td>
                        <td className="px-5 py-4">
                          <a href={`mailto:${row.parent_email}`} className="text-[#9a7a18] hover:underline">{row.parent_email}</a>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <a href={`tel:${row.parent_phone}`} className="text-gray-600 hover:text-[#1a1a2e]">{row.parent_phone}</a>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-gray-400">{formatDate(row.submitted_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
              Showing {filtered.length} of {interests.length} entries
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
