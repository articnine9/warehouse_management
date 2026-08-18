"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  LayoutDashboard,
  Receipt,
  Search,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import WarningPopup from "./WarningPopup";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [authLoading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setWarningMessage("");
    setWarningOpen(false);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Invalid email or password");
        setWarningOpen(true);
        return;
      }

      await refreshUser();
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Authentication error:", error);
      setWarningMessage("Something went wrong. Please try again.");
      setWarningOpen(true);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-sm">
          <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left panel — Brand / Info (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-10 text-white">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            <Package className="h-4 w-4" />
            Warehouse Management System
          </div>

          <div className="mt-12 max-w-lg space-y-5">
            <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
              Manage your warehouse operations with ease
            </h1>
            <p className="text-lg leading-relaxed text-blue-100">
              Internal portal for administrators and authorized warehouse staff to track inventory, manage stock, generate invoices, and handle dispatch.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
            <LayoutDashboard className="h-8 w-8" />
            <p className="mt-3 text-sm font-semibold">Real-time Dashboard</p>
            <p className="mt-1 text-xs text-blue-200">Monitor stock levels</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
            <Receipt className="h-8 w-8" />
            <p className="mt-3 text-sm font-semibold">Billing & Invoices</p>
            <p className="mt-1 text-xs text-blue-200">Generate & print bills</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
            <Search className="h-8 w-8" />
            <p className="mt-3 text-sm font-semibold">Quick Search</p>
            <p className="mt-1 text-xs text-blue-200">Find any product fast</p>
          </div>
        </div>
      </div>

      {/* Right panel — Form */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-10 lg:w-[45%] lg:px-12">
        {/* Mobile brand header */}
        <div className="mb-8 text-center lg:hidden">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            <Package className="h-4 w-4" />
            Warehouse Management
          </div>
        </div>

        <div className="w-full max-w-md">
          {/* Heading */}
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 mb-3">
              <Lock className="h-3.5 w-3.5" /> Staff & Admin Portal
            </div>
            <h2 className="text-2xl font-bold text-slate-800">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Enter your authorized email and password to access the system.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {warningOpen && (
              <WarningPopup
                open={warningOpen}
                message={warningMessage}
                onClose={() => setWarningOpen(false)}
              />
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-center text-xs text-slate-500">
            <p className="font-medium text-slate-600">Need staff account access?</p>
            <p className="mt-0.5 text-slate-400">Staff accounts and passwords are created and managed by the System Administrator.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
