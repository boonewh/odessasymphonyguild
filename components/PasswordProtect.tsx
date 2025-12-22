"use client";

import { useState, ReactNode } from "react";

interface PasswordProtectProps {
  children: ReactNode;
  correctUsername?: string;
  correctPassword?: string;
}

export default function PasswordProtect({
  children,
  correctUsername = "demo",
  correctPassword = "demo"
}: PasswordProtectProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (username === correctUsername && password === correctPassword) {
      setIsUnlocked(true);
      setError("");
    } else {
      setError("Incorrect username or password. Please try again.");
      setUsername("");
      setPassword("");
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#2d3748] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light text-[#1a1a2e] mb-2">
            Demo Access Required
          </h1>
          <p className="text-gray-600 text-sm">
            This is a demonstration page. Please enter the password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
              placeholder="Enter username"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
              placeholder="Enter password"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-[#d4af37] text-[#1a1a2e] py-3 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors"
          >
            Access Demo
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            This page is under development and not yet available to the public.
          </p>
        </div>
      </div>
    </div>
  );
}
