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
  BellRing,
  Wrench,
  CheckCircle2,
  X,
  User,
  Calendar,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import ProductSearch from "@/app/components/ProductSearch";
import ProtectedPage from "@/app/components/ProtectedPage";
import { useAuth } from "@/app/components/AuthProvider";

type Metric = {
  label: string;
  value: string | number;
};

type ServiceAlert = {
  issueId: string;
  issueNumber: string;
  itemIndex: number;
  employeeName: string;
  employeeEmail?: string;
  employeePhone?: string;
  employeeDepartment?: string;
  productName: string;
  sku: string;
  serialNumber?: string;
  serviceStage: string;
  serviceDate: string;
  holdingStatus: "ACTIVE" | "INACTIVE" | "UNDER_SERVICE" | "RETURNED" | "DAMAGED";
  isOverdue: boolean;
  daysRemaining: number;
};

type LowStockItem = {
  id: string;
  productName: string;
  sku: string;
  rackName: string;
  rackCode: string;
  quantity: number;
  status: string;
};

type DashboardSummary = {
  success: boolean;
  role: "ADMIN" | "STAFF";
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: "ADMIN" | "STAFF";
      warehouse?: {
        id: string;
        name: string;
        code: string;
      } | null;
    };
    metrics: Metric[];
    lowStockItems?: LowStockItem[];
    serviceAlerts?: ServiceAlert[];
  };
};

function getMetricLink(label: string, role: "ADMIN" | "STAFF") {
  if (role === "ADMIN") {
    switch (label) {
      case "Warehouses":
        return "/warehouses";
      case "Racks":
        return "/racks";
      case "Products":
        return "/products";
      case "Total Stock":
      case "Low / Out":
        return "/inventory";
      case "Staff":
        return "/staff";
      default:
        return "/dashboard";
    }
  }

  switch (label) {
    case "Assigned Warehouse":
    case "Products in Warehouse":
    case "Total Units":
    case "Attention Needed":
      return "/staff";
    default:
      return "/dashboard";
  }
}

function getMetricIcon(label: string) {
  switch (label) {
    case "Warehouses":
    case "Assigned Warehouse":
      return <Warehouse className="h-5 w-5 text-blue-600" />;
    case "Racks":
      return <Box className="h-5 w-5 text-amber-600" />;
    case "Products":
    case "Products in Warehouse":
      return <Tag className="h-5 w-5 text-emerald-600" />;
    case "Total Stock":
    case "Total Units":
      return <ClipboardList className="h-5 w-5 text-violet-600" />;
    case "Staff":
      return <Users className="h-5 w-5 text-sky-600" />;
    case "Low / Out":
    case "Attention Needed":
      return <AlertTriangle className="h-5 w-5 text-rose-600" />;
    default:
      return <Building2 className="h-5 w-5 text-slate-600" />;
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state for service completion
  const [selectedAlert, setSelectedAlert] = useState<ServiceAlert | null>(null);
  const [serviceNotes, setServiceNotes] = useState("");
  const [markingService, setMarkingService] = useState(false);

  async function fetchSummary() {
    try {
      setLoading(true);
      const response = await fetch("/api/dashboard", { cache: "no-store" });
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

  useEffect(() => {
    void fetchSummary();
  }, []);

  async function handleMarkServiceDone(alertTarget?: ServiceAlert) {
    const alertItem = alertTarget || selectedAlert;
    if (!alertItem) return;

    setMarkingService(true);
    try {
      const res = await fetch(`/api/employee-issues/${alertItem.issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIndex: alertItem.itemIndex,
          action: "COMPLETE_SERVICE",
          serviceNotes: serviceNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSelectedAlert(null);
        setServiceNotes("");
        await fetchSummary();
      } else {
        alert(data.message || "Failed to update service status");
      }
    } catch (error) {
      console.error("Failed to mark service done:", error);
      alert("Something went wrong");
    } finally {
      setMarkingService(false);
    }
  }

  const serviceAlerts = summary?.data?.serviceAlerts || [];
  const overdueCount = serviceAlerts.filter((a) => a.isOverdue).length;

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {user?.role === "ADMIN"
              ? "Monitor warehouses, inventory stock, recurring maintenance alerts, and staff operations."
              : "Track your assigned warehouse inventory and equipment maintenance."}
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

        {/* Metric cards */}
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

        {/* 🔔 Dedicated Service Notifications Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 p-4 md:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shrink-0">
                <BellRing className={`h-5 w-5 ${serviceAlerts.length > 0 ? "animate-bounce" : ""}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-slate-800">
                    Product Service & Maintenance Alerts
                  </h2>
                  {serviceAlerts.length > 0 ? (
                    <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 text-xs font-extrabold">
                      {serviceAlerts.length} Due
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold flex items-center gap-1">
                      <Check className="h-3 w-3" /> Up to date
                    </span>
                  )}
                  {overdueCount > 0 && (
                    <span className="rounded-full bg-red-600 text-white px-2.5 py-0.5 text-xs font-extrabold animate-pulse">
                      {overdueCount} Overdue
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Recurring service interval maintenance due within the next 30 days.
                </p>
              </div>
            </div>

            <Link
              href="/product-history"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0"
            >
              View Product History <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Alert Content */}
          {serviceAlerts.length > 0 ? (
            <div className="p-4 md:p-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {serviceAlerts.map((alert) => {
                const dateObj = new Date(alert.serviceDate);
                const formattedDate = dateObj.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <div
                    key={`${alert.issueId}-${alert.itemIndex}-${alert.serviceStage}`}
                    className={`rounded-xl border p-4 shadow-xs transition hover:shadow-md flex flex-col justify-between ${
                      alert.isOverdue
                        ? "border-red-200 bg-red-50/40 hover:border-red-300"
                        : "border-amber-200 bg-amber-50/40 hover:border-amber-300"
                    }`}
                  >
                    <div>
                      {/* Product Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-sm truncate">
                            {alert.productName}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            SKU: <b>{alert.sku}</b> {alert.serialNumber && alert.serialNumber !== "-" && `• SN: ${alert.serialNumber}`}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                            alert.isOverdue
                              ? "bg-red-600 text-white"
                              : "bg-amber-500 text-white"
                          }`}
                        >
                          {alert.isOverdue
                            ? `OVERDUE (${Math.abs(alert.daysRemaining)}d)`
                            : `${alert.daysRemaining} DAYS LEFT`}
                        </span>
                      </div>

                      {/* Employee Holder Details */}
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 bg-white/90 p-3 rounded-lg border border-slate-100 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">Holder:</span>
                          <span className="font-bold text-slate-800 truncate">
                            {alert.employeeName} {alert.employeeDepartment ? `(${alert.employeeDepartment})` : ""}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">Cycle:</span>
                          <span className="font-bold text-blue-700">
                            {alert.serviceStage}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">Due Date:</span>
                          <span className="font-bold text-slate-800">{formattedDate}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">Status:</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              alert.holdingStatus === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {alert.holdingStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-3.5 flex items-center gap-2 pt-2 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAlert(alert);
                          setServiceNotes("");
                        }}
                        className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98] flex items-center justify-center gap-1"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        Complete Service
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">All equipment is up to date!</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No equipment is currently overdue or due for maintenance in the next 30 days.
              </p>
            </div>
          )}
        </div>

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
                  className="rounded-lg border border-slate-100 bg-slate-50/50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {item.productName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.sku}
                      </p>
                    </div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.status === "LOW_STOCK"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                    <span>
                      Rack: {item.rackName} ({item.rackCode})
                    </span>
                    <span className="font-semibold text-slate-800">
                      Qty: {item.quantity}
                    </span>
                  </div>
                </div>
              ))}
              {summary.data.lowStockItems?.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-400">
                  No low stock items in your warehouse.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Global Inventory Directory with Live Search & Pagination */}
        <ProductSearch />

        {/* 📋 Detailed Service Completion Modal */}
        {selectedAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-2xl space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Complete Equipment Service</h3>
                    <p className="text-xs text-slate-400">Issue #{selectedAlert.issueNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAlert(null)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Status Banner */}
              <div
                className={`rounded-xl p-3.5 flex items-center justify-between ${
                  selectedAlert.isOverdue
                    ? "bg-red-50 border border-red-200 text-red-800"
                    : "bg-amber-50 border border-amber-200 text-amber-800"
                }`}
              >
                <div>
                  <p className="font-bold text-sm flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {selectedAlert.serviceStage} is {selectedAlert.isOverdue ? "OVERDUE" : "UPCOMING"}
                  </p>
                  <p className="text-xs mt-0.5 opacity-90">
                    Due Date: {new Date(selectedAlert.serviceDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-white shadow-xs">
                  {selectedAlert.isOverdue
                    ? `${Math.abs(selectedAlert.daysRemaining)} Days Ago`
                    : `${selectedAlert.daysRemaining} Days Left`}
                </span>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Employee (Holder)</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedAlert.employeeName}</p>
                  <p className="text-slate-500">{selectedAlert.employeePhone || "-"}</p>
                  <p className="text-slate-500">{selectedAlert.employeeDepartment || "-"}</p>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Product Info</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedAlert.productName}</p>
                  <p className="text-slate-500">SKU: {selectedAlert.sku}</p>
                  {selectedAlert.serialNumber && selectedAlert.serialNumber !== "-" && (
                    <p className="text-blue-700 font-semibold">SN: {selectedAlert.serialNumber}</p>
                  )}
                </div>

                <div className="border-t border-slate-200/60 pt-2.5">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Service Cycle</span>
                  <p className="font-semibold text-slate-700 mt-0.5">
                    {selectedAlert.serviceStage}
                  </p>
                </div>

                <div className="border-t border-slate-200/60 pt-2.5">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Product Status</span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${
                        selectedAlert.holdingStatus === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : selectedAlert.holdingStatus === "INACTIVE"
                          ? "bg-slate-200 text-slate-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {selectedAlert.holdingStatus} (With Employee)
                    </span>
                  </p>
                </div>
              </div>

              {/* Service Completion Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Service Remarks / Parts Replaced (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Serviced by technician, filter changed, inspection completed..."
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={markingService}
                  onClick={() => handleMarkServiceDone()}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {markingService ? "Saving..." : "✓ Complete Service & Schedule Next Cycle"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAlert(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
