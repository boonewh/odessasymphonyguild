"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";

const FIELDS = [
  { key: "dues_freshman",      label: "Freshman (New)",          description: "All 9th graders" },
  { key: "dues_returning",     label: "Returning Member",        description: "Returning Soph / Junior / Senior" },
  { key: "dues_new_sophomore", label: "First-Time Sophomore",    description: "New member buy-in" },
  { key: "dues_new_junior",    label: "First-Time Junior",       description: "New member buy-in" },
  { key: "dues_new_senior",    label: "First-Time Senior",       description: "New member buy-in" },
  { key: "late_fee",           label: "Late Fee",                description: "Added after June 30, 2026" },
];

export default function AdminPricing() {
  const router = useRouter();
  const [values, setValues]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);
  const [saved, setSaved]     = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => { setValues(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (key: string) => {
    setSaving(key);
    setError(null);

    const res = await fetch("/api/admin/settings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ key, value: values[key] }),
    });

    if (res.ok) {
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save.");
    }

    setSaving(null);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <section className="bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] py-12 text-white">
        <div className="max-w-3xl mx-auto px-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-wide mb-1">Dues & Pricing</h1>
            <p className="text-[#d4af37] text-sm tracking-wider">
              {BELLES_BEAUX_CONFIG.schoolYear} Season &mdash; Admin Settings
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/admin/belles-beaux")}
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              ← Roster
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

      <section className="py-10">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-sm text-amber-800">
            Changes take effect immediately on the signup form. Double-check amounts before saving.
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8 flex items-center justify-between">
            <div>
              <p className="font-medium text-[#1a1a2e]">QuickBooks Connection</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Use this if the system stops creating invoices or the QB connection needs to be refreshed.
              </p>
            </div>
            <a
              href="/api/quickbooks/auth?key=osg2026"
              className="px-5 py-2.5 bg-[#2CA01C] text-white rounded-lg text-sm font-semibold hover:bg-[#258a18] transition-colors whitespace-nowrap"
            >
              Connect to QuickBooks
            </a>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading settings...</div>
          ) : (
            <div className="space-y-4">
              {FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-6"
                >
                  <div className="flex-1">
                    <p className="font-medium text-[#1a1a2e]">{field.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{field.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      value={values[field.key] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-transparent text-right"
                    />
                    <button
                      onClick={() => handleSave(field.key)}
                      disabled={saving === field.key}
                      className="px-4 py-2 bg-[#d4af37] text-[#1a1a2e] rounded-lg text-sm font-semibold hover:bg-[#c19b2e] transition-colors disabled:opacity-50 min-w-[72px]"
                    >
                      {saving === field.key
                        ? "..."
                        : saved === field.key
                        ? "Saved ✓"
                        : "Save"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
