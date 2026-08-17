"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  LayoutDashboard,
  Receipt,
  Search,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "./AuthProvider";

type Warehouse = {
  _id: string;
  name: string;
  code: string;
};

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (mode !== "register") {
      return;
    }

    async function fetchWarehouses() {
      try {
        const response = await fetch("/api/warehouses");
        const result = await response.json();

        if (result.success) {
          setWarehouses(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch warehouses:", error);
      }
    }

    void fetchWarehouses();
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const endpoint =
      mode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          warehouseId,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setMessage(result.message || "Request failed");
        return;
      }

      await refreshUser();
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Authentication error:", error);
      setMessage("Something went wrong");
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
              Admin and staff collaboration platform for tracking inventory, managing stock, generating bills, and monitoring warehouse performance.
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
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                mode === "login"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                mode === "register"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Register
            </button>
          </div>

          {/* Heading */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-slate-800">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {mode === "login"
                ? "Sign in to your warehouse account."
                : "Register a new staff account."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "register" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Full name
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

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

            {mode === "register" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Assigned warehouse
                </label>
                <select
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse._id} value={warehouse._id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {message && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4" />
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
            >
              {loading
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            {mode === "login"
              ? "Don't have an account? Switch to Register tab."
              : "Already have an account? Switch to Login tab."}
          </p>
        </div>
      </div>
    </div>
  );
}
