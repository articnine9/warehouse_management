"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Warehouse,
  Box,
  Tag,
  ClipboardList,
  Users,
  AlertTriangle,
  Building2,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";
import ProductSearch from "@/app/components/ProductSearch";
import ProtectedPage from "@/app/components/ProtectedPage";
import { useAuth } from "@/app/components/AuthProvider";

type Metric = {
  label: string;
  value: string | number;
};

type DashboardResponse = {
  role: "ADMIN" | "STAFF";
  data: {
    metrics: Metric[];
    lowStockItems?: Array<{
      id: string;
      productName: string;
      sku: string;
      rackName: string;
      rackCode: string;
      quantity: number;
      status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
    }>;
  };
};

function getMetricLink(label: string, role?: string): string {
  if (role === "STAFF") {
    switch (label) {
      case "Attention Needed":
        return "/staff?status=attention";
      case "Assigned Warehouse":
      case "Products in Warehouse":
      case "Total Units":
        return "/staff";
      default:
        return "/dashboard";
    }
  }

  switch (label) {
    case "Warehouses":
      return "/warehouses";
    case "Racks":
      return "/racks";
    case "Products":
      return "/products";
    case "Total Stock":
      return "/inventory";
    case "Low / Out":
      return "/inventory?status=LOW_OUT";
    case "Staff":
      return "/staff";
    default:
      return "/dashboard";
  }
}

function getMetricIcon(label: string) {
  switch (label) {
    case "Warehouses":
      return <Warehouse className="h-5 w-5" />;
    case "Racks":
      return <Box className="h-5 w-5" />;
    case "Products":
    case "Products in Warehouse":
      return <Tag className="h-5 w-5" />;
    case "Total Stock":
    case "Total Units":
      return <ClipboardList className="h-5 w-5" />;
    case "Staff":
      return <Users className="h-5 w-5" />;
    case "Low / Out":
    case "Attention Needed":
      return <AlertTriangle className="h-5 w-5" />;
    case "Assigned Warehouse":
      return <Building2 className="h-5 w-5" />;
    default:
      return <LayoutDashboard className="h-5 w-5" />;
  }
}

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchSummary() {
      try {
        setLoading(true);
        const response = await fetch("/api/dashboard", {
          cache: "no-store",
        });
        const result = await response.json();

        if (result.success) {
          setSummary(result);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard summary:", error);
      } finally {
        setLoading(false);
      }
    }

    void fetchSummary();
  }, []);

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            {user?.role === "ADMIN"
              ? "Monitor warehouses, stock, and staff operations. Click any card to navigate."
              : "Track your assigned warehouse stock and attention items."}
          </p>
        </div>

        {/* Loading skeleton */}
        {loading && !summary && (
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-4 animate-pulse" />
            ))}
          </div>
        )}

        {/* Metric cards with direct navigation links */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {summary.data.metrics.map((metric) => {
              const targetLink = getMetricLink(metric.label, summary.role);
              const icon = getMetricIcon(metric.label);

              return (
                <Link
                  key={metric.label}
                  href={targetLink}
                  className="group relative rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm transition hover:border-blue-400 hover:shadow-md active:scale-[0.99] flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 md:text-sm">
                      {metric.label}
                    </span>
                    {icon}
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <h2 className="text-2xl font-bold text-slate-800 md:text-3xl group-hover:text-blue-600 transition">
                      {metric.value}
                    </h2>
                    <span className="text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      View <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Low stock table — staff view */}
        {summary?.role === "STAFF" && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 md:p-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Stock needing attention
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Low stock and out of stock items from your warehouse.
                </p>
              </div>
              <Link
                href="/staff"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View all in My Warehouse →
              </Link>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Rack</th>
                    <th className="px-5 py-3">Quantity</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.data.lowStockItems?.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {item.productName}
                        <span className="ml-2 text-xs text-slate-400">
                          ({item.sku})
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {item.rackName} ({item.rackCode})
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800">
                        {item.quantity}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.status === "LOW_STOCK"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {item.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {summary.data.lowStockItems?.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-8 text-center text-slate-400"
                      >
                        No low stock items in your warehouse.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 p-4 md:hidden">
              {summary.data.lowStockItems?.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-800">
                        {item.productName}
                      </p>
                      <p className="text-xs text-slate-400">{item.sku}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.status === "LOW_STOCK"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                    <span>
                      Rack: {item.rackName} ({item.rackCode})
                    </span>
                    <span className="font-semibold text-slate-700">
                      Qty: {item.quantity}
                    </span>
                  </div>
                </div>
              ))}
              {summary.data.lowStockItems?.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">
                  No low stock items in your warehouse.
                </p>
              )}
            </div>
          </div>
        )}

        <ProductSearch />
      </div>
    </ProtectedPage>
  );
}
