"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/admin/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin/belles-beaux");
    } else {
      setError("Incorrect password.");
      setPassword("");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#1a1a2e]">Admin Access</h1>
          <p className="text-sm text-gray-500 mt-1">Belles &amp; Beaux Roster</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="Enter password"
            autoFocus
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent mb-3"
          />
          {error && (
            <p className="text-sm text-red-600 mb-3">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#d4af37] text-[#1a1a2e] py-3 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
