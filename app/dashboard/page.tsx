"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Warehouse,
  Box,
  Tag,
  FolderTree,
  ClipboardList,
  Users,
  AlertTriangle,
  AlertOctagon,
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
  RefreshCw,
  PackageCheck,
} from "lucide-react";
import ProductSearch from "@/app/components/ProductSearch";
import ProtectedPage from "@/app/components/ProtectedPage";
import { useAuth } from "@/app/components/AuthProvider";
import WarningPopup from "@/app/components/WarningPopup";

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

type ReusableAlert = {
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
  returnDueDays: number;
  returnDueDate: string;
  renewalCount: number;
  holdingStatus: "ACTIVE" | "INACTIVE" | "UNDER_SERVICE" | "RETURNED" | "DAMAGED";
  isOverdue: boolean;
  daysRemaining: number;
};

type StockAlert = {
  id: string;
  productId: string;
  warehouseId: string;
  rackId: string;
  productName: string;
  sku: string;
  warehouseName: string;
  rackName: string;
  quantity: number;
  status: "LOW_STOCK" | "OUT_OF_STOCK";
};

type LowStockItem = {
  id: string;
  productName: string;
  sku: string;
  rackName: string;
  rackCode: string;
  quantity: number;
  status: "LOW_STOCK" | "OUT_OF_STOCK";
};

type DashboardSummary = {
  role: "ADMIN" | "STAFF";
  data: {
    metrics: Metric[];
    lowStockItems?: LowStockItem[];
    serviceAlerts?: ServiceAlert[];
    reusableAlerts?: ReusableAlert[];
    stockAlerts?: StockAlert[];
  };
};

function getMetricLink(label: string, role?: string): string {
  switch (label) {
    case "Total Warehouses":
      return "/warehouses";
    case "Total Categories":
      return "/categories";
    case "Total Products":
      return "/products";
    case "Inventory Stock":
      return "/inventory";
    case "Total Staff":
      return "/staff";
    case "Total Billing Orders":
      return "/billing";
    case "Attention Needed":
      return "/inventory";
    case "Assigned Racks":
      return "/racks";
    case "Assigned Products":
      return "/staff";
    case "Stock Items":
      return "/staff";
    case "Low / Out":
      return "/staff";
    default:
      return role === "STAFF" ? "/staff" : "/warehouses";
  }
}

function getMetricIcon(label: string) {
  switch (label) {
    case "Total Warehouses":
      return <Warehouse className="h-5 w-5 text-blue-600" />;
    case "Total Categories":
      return <FolderTree className="h-5 w-5 text-indigo-600" />;
    case "Total Products":
      return <Box className="h-5 w-5 text-emerald-600" />;
    case "Inventory Stock":
      return <Tag className="h-5 w-5 text-amber-600" />;
    case "Total Staff":
      return <Users className="h-5 w-5 text-purple-600" />;
    case "Total Billing Orders":
      return <ClipboardList className="h-5 w-5 text-teal-600" />;
    case "Assigned Racks":
      return <Warehouse className="h-5 w-5 text-blue-600" />;
    case "Assigned Products":
      return <Box className="h-5 w-5 text-emerald-600" />;
    case "Stock Items":
      return <AlertOctagon className="h-5 w-5 text-rose-600" />;
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

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Tab filter for alerts
  const [alertTab, setAlertTab] = useState<"ALL" | "REUSABLE" | "STOCK" | "SERVICE">("ALL");

  // Modal state for service completion
  const [selectedAlert, setSelectedAlert] = useState<ServiceAlert | null>(null);
  const [serviceNotes, setServiceNotes] = useState("");
  const [markingService, setMarkingService] = useState(false);

  // Modal state for Reusable Renewal
  const [selectedReusableAlert, setSelectedReusableAlert] = useState<ReusableAlert | null>(null);
  const [renewDays, setRenewDays] = useState("30");
  const [renewNotes, setRenewNotes] = useState("");
  const [renewing, setRenewing] = useState(false);

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
        setWarningMessage(data.message || "Failed to update service status");
        setWarningOpen(true);
      }
    } catch (error) {
      console.error("Failed to mark service done:", error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setMarkingService(false);
    }
  }

  async function handleRenewItem() {
    if (!selectedReusableAlert) return;
    const days = parseInt(renewDays, 10);
    if (isNaN(days) || days <= 0) {
      setWarningMessage("Please enter a valid number of days to extend");
      setWarningOpen(true);
      return;
    }

    setRenewing(true);
    try {
      const res = await fetch(`/api/employee-issues/${selectedReusableAlert.issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIndex: selectedReusableAlert.itemIndex,
          action: "RENEW_ITEM",
          extendedDays: days,
          renewalNotes: renewNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSelectedReusableAlert(null);
        setRenewNotes("");
        await fetchSummary();
      } else {
        setWarningMessage(data.message || "Failed to renew item");
        setWarningOpen(true);
      }
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setRenewing(false);
    }
  }

  async function handleReturnItem(item: ReusableAlert) {
    if (!confirm(`Return ${item.productName} back to warehouse stock?`)) return;

    try {
      const res = await fetch(`/api/employee-issues/${item.issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIndex: item.itemIndex,
          action: "UPDATE_STATUS",
          holdingStatus: "RETURNED",
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchSummary();
      } else {
        setWarningMessage(data.message || "Failed to return item");
        setWarningOpen(true);
      }
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    }
  }

  const serviceAlerts = summary?.data?.serviceAlerts || [];
  const reusableAlerts = summary?.data?.reusableAlerts || [];
  const stockAlerts = summary?.data?.stockAlerts || [];
  const totalAlerts = reusableAlerts.length + stockAlerts.length + serviceAlerts.length;

  const overdueCount =
    serviceAlerts.filter((a) => a.isOverdue).length +
    reusableAlerts.filter((a) => a.isOverdue).length;

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {user?.role === "ADMIN"
              ? "Monitor warehouses, inventory stock, recurring maintenance alerts, reusable return validities, and staff operations."
              : "Track your assigned warehouse inventory, reusable returns, and equipment maintenance."}
          </p>
        </div>

        {/* ─── 1. METRIC COUNT CARDS (1st ORDER) ─── */}
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

        {/* 🔔 COMPREHENSIVE NOTIFICATION & ALERTS CENTER ON DASHBOARD */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="border-b border-slate-100 p-4 md:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
                <BellRing className={`h-5 w-5 ${totalAlerts > 0 ? "animate-bounce" : ""}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-slate-800">
                    Live System Alerts & Action Center
                  </h2>
                  {totalAlerts > 0 ? (
                    <span className="rounded-full bg-blue-100 text-blue-900 border border-blue-200 px-2.5 py-0.5 text-xs font-extrabold">
                      {totalAlerts} Total Alerts
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold flex items-center gap-1">
                      <Check className="h-3 w-3" /> All Up to date
                    </span>
                  )}
                  {overdueCount > 0 && (
                    <span className="rounded-full bg-red-600 text-white px-2.5 py-0.5 text-xs font-extrabold animate-pulse">
                      {overdueCount} Overdue
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reusable product returns, low stock warnings, and maintenance intervals requiring action.
                </p>
              </div>
            </div>

            {/* Tab Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setAlertTab("ALL")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  alertTab === "ALL"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                All ({totalAlerts})
              </button>
              <button
                type="button"
                onClick={() => setAlertTab("REUSABLE")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  alertTab === "REUSABLE"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-indigo-50 border border-slate-200"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Return / Renew ({reusableAlerts.length})
              </button>
              <button
                type="button"
                onClick={() => setAlertTab("STOCK")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  alertTab === "STOCK"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-amber-50 border border-slate-200"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Stock Alerts ({stockAlerts.length})
              </button>
              <button
                type="button"
                onClick={() => setAlertTab("SERVICE")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  alertTab === "SERVICE"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-blue-50 border border-slate-200"
                }`}
              >
                <Wrench className="h-3.5 w-3.5" /> Service ({serviceAlerts.length})
              </button>
            </div>
          </div>

          {/* ─── COMPACT ALERT LIST VIEW ─── */}
          <div className="p-0">
            {totalAlerts === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Everything is running smoothly!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No reusable items overdue, no stock shortages, and no upcoming service maintenance in the next 30 days.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* 1. REUSABLE ASSET RETURN / RENEWAL ALERTS */}
                {(alertTab === "ALL" || alertTab === "REUSABLE") &&
                  reusableAlerts.map((alert) => {
                    const dateObj = new Date(alert.returnDueDate);
                    const formattedDate = dateObj.toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <div
                        key={`reusable-${alert.issueId}-${alert.itemIndex}`}
                        className={`flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between transition hover:bg-slate-50/80 ${
                          alert.isOverdue ? "bg-red-50/20" : ""
                        }`}
                      >
                        {/* Info Left */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-2xs ${
                              alert.isOverdue
                                ? "bg-red-100 text-red-700"
                                : "bg-indigo-100 text-indigo-700"
                            }`}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-slate-800 text-sm truncate">
                                {alert.productName}
                              </p>
                              <span className="rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700">
                                Reusable
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                  alert.isOverdue
                                    ? "bg-red-600 text-white"
                                    : "bg-indigo-600 text-white"
                                }`}
                              >
                                {alert.isOverdue
                                  ? `OVERDUE (${Math.abs(alert.daysRemaining)}d)`
                                  : `${alert.daysRemaining} DAYS LEFT`}
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-x-2 flex-wrap">
                              <span>Holder: <b className="text-slate-700">{alert.employeeName}</b> {alert.employeeDepartment ? `(${alert.employeeDepartment})` : ""}</span>
                              <span>• SKU: <b className="text-slate-700">{alert.sku}</b></span>
                              <span>• Due: <b className="text-slate-700">{formattedDate}</b></span>
                              {alert.renewalCount > 0 && (
                                <span className="text-indigo-600 font-semibold">({alert.renewalCount}x renewed)</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons Right */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReusableAlert(alert);
                              setRenewDays(alert.returnDueDays?.toString() || "30");
                              setRenewNotes("");
                            }}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-indigo-700 active:scale-95 flex items-center gap-1"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Renew
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReturnItem(alert)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition active:scale-95"
                          >
                            Return
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {/* 2. STOCK ALERTS */}
                {(alertTab === "ALL" || alertTab === "STOCK") &&
                  stockAlerts.map((stock) => (
                    <div
                      key={`stock-${stock.id}`}
                      className={`flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between transition hover:bg-slate-50/80 ${
                        stock.status === "OUT_OF_STOCK" ? "bg-rose-50/20" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-2xs ${
                            stock.status === "OUT_OF_STOCK"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-800 text-sm truncate">
                              {stock.productName}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                stock.status === "OUT_OF_STOCK"
                                  ? "bg-rose-600 text-white"
                                  : "bg-amber-500 text-white"
                              }`}
                            >
                              {stock.status === "OUT_OF_STOCK" ? "OUT OF STOCK" : "LOW STOCK"}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-x-2 flex-wrap">
                            <span>Warehouse: <b className="text-slate-700">{stock.warehouseName}</b></span>
                            <span>• Rack: <b className="text-slate-700">{stock.rackName}</b></span>
                            <span>• SKU: <b className="text-slate-700">{stock.sku}</b></span>
                            <span className="font-bold text-slate-700">
                              Qty: <span className={stock.quantity === 0 ? "text-rose-600" : "text-amber-600"}>{stock.quantity} units</span>
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 self-end sm:self-center">
                        <Link
                          href={`/inventory?productId=${stock.productId}&warehouseId=${stock.warehouseId}&rackId=${stock.rackId}&restock=true`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition flex items-center gap-1"
                        >
                          Restock <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  ))}

                {/* 3. SERVICE & MAINTENANCE ALERTS */}
                {(alertTab === "ALL" || alertTab === "SERVICE") &&
                  serviceAlerts.map((alert) => {
                    const dateObj = new Date(alert.serviceDate);
                    const formattedDate = dateObj.toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <div
                        key={`service-${alert.issueId}-${alert.itemIndex}-${alert.serviceStage}`}
                        className={`flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between transition hover:bg-slate-50/80 ${
                          alert.isOverdue ? "bg-red-50/20" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-2xs ${
                              alert.isOverdue
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            <Wrench className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-slate-800 text-sm truncate">
                                {alert.productName}
                              </p>
                              <span className="rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.2 text-[10px] font-bold text-blue-700">
                                {alert.serviceStage}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                  alert.isOverdue
                                    ? "bg-red-600 text-white"
                                    : "bg-blue-600 text-white"
                                }`}
                              >
                                {alert.isOverdue
                                  ? `OVERDUE (${Math.abs(alert.daysRemaining)}d)`
                                  : `${alert.daysRemaining} DAYS LEFT`}
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-x-2 flex-wrap">
                              <span>Holder: <b className="text-slate-700">{alert.employeeName}</b> {alert.employeeDepartment ? `(${alert.employeeDepartment})` : ""}</span>
                              <span>• SKU: <b className="text-slate-700">{alert.sku}</b></span>
                              <span>• Due: <b className="text-slate-700">{formattedDate}</b></span>
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAlert(alert);
                              setServiceNotes("");
                            }}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-blue-700 active:scale-95 flex items-center gap-1"
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            Complete Service
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* ─── 3. SEARCH & LIST TABLES (3rd ORDER) ─── */}
        <div className="space-y-4">
          <ProductSearch />
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
                <tbody className="divide-y divide-slate-100">
                  {(summary.data.lowStockItems || []).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">{item.productName}</p>
                        <p className="text-xs text-slate-500">SKU: {item.sku}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {item.rackName} ({item.rackCode})
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800">{item.quantity}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            item.status === "OUT_OF_STOCK"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {item.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── MODAL: COMPLETE SERVICE ─── */}
        {selectedAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-base">Complete Service Maintenance</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAlert(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-blue-50/60 p-3.5 border border-blue-100 text-xs space-y-1">
                  <p className="font-bold text-slate-800 text-sm">{selectedAlert.productName}</p>
                  <p className="text-slate-600">
                    Holder: <b>{selectedAlert.employeeName}</b> ({selectedAlert.employeeDepartment || "-"})
                  </p>
                  <p className="text-slate-600">
                    Cycle: <b>{selectedAlert.serviceStage}</b> • Due Date:{" "}
                    <b>{new Date(selectedAlert.serviceDate).toLocaleDateString("en-IN")}</b>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Service Remarks / Maintenance Notes:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="E.g., Oil change completed, parts replaced, inspected and working normally..."
                    value={serviceNotes}
                    onChange={(e) => setServiceNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAlert(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={markingService}
                    onClick={() => void handleMarkServiceDone()}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Check className="h-4 w-4" />
                    {markingService ? "Saving..." : "Mark Maintenance Complete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: RENEW REUSABLE ASSET PERIOD ─── */}
        {selectedReusableAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-base">Extend / Renew Validity Period</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReusableAlert(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3.5">
                <div className="rounded-xl bg-indigo-50/60 p-3.5 border border-indigo-100 text-xs space-y-1">
                  <p className="font-bold text-slate-800 text-sm">{selectedReusableAlert.productName}</p>
                  <p className="text-slate-600">
                    Holder: <b>{selectedReusableAlert.employeeName}</b> ({selectedReusableAlert.employeeDepartment || "-"})
                  </p>
                  <p className="text-slate-600">
                    Current Due Date:{" "}
                    <b>{new Date(selectedReusableAlert.returnDueDate).toLocaleDateString("en-IN")}</b>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Extend By How Many Days?
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={renewDays}
                      onChange={(e) => setRenewDays(e.target.value)}
                      className="w-24 rounded-xl border border-slate-200 bg-white p-2 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                    <div className="flex flex-wrap gap-1">
                      {["7", "15", "30", "60", "90"].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setRenewDays(d)}
                          className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                            renewDays === d
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
                          }`}
                        >
                          +{d}d
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Renewal Remarks (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., Project extended for another month..."
                    value={renewNotes}
                    onChange={(e) => setRenewNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReusableAlert(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={renewing}
                    onClick={() => void handleRenewItem()}
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Check className="h-4 w-4" />
                    {renewing ? "Extending..." : "Confirm Extension"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <WarningPopup
          open={warningOpen}
          message={warningMessage}
          onClose={() => setWarningOpen(false)}
        />
      </div>
    </ProtectedPage>
  );
}
