"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Wrench,
  AlertTriangle,
  AlertOctagon,
  X,
  ArrowRight,
  RefreshCw,
  RotateCcw,
  Package,
  Calendar,
  Layers,
} from "lucide-react";
import Link from "next/link";
import WarningPopup from "./WarningPopup";

type ServiceAlert = {
  issueId: string;
  issueNumber: string;
  itemIndex: number;
  employeeName: string;
  employeePhone?: string;
  employeeDepartment?: string;
  productName: string;
  sku: string;
  serialNumber?: string;
  serviceStage: string;
  serviceDate: string;
  holdingStatus: string;
  isOverdue: boolean;
  daysRemaining: number;
};

type ReusableAlert = {
  issueId: string;
  issueNumber: string;
  itemIndex: number;
  employeeName: string;
  employeePhone?: string;
  employeeDepartment?: string;
  productName: string;
  sku: string;
  serialNumber?: string;
  returnDueDays: number;
  returnDueDate: string;
  renewalCount: number;
  holdingStatus: string;
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

type TabType = "ALL" | "REUSABLE" | "STOCK" | "SERVICE";

type SharedAlertsData = {
  serviceAlerts: ServiceAlert[];
  reusableAlerts: ReusableAlert[];
  stockAlerts: StockAlert[];
};

let sharedAlertsCache: SharedAlertsData | null = null;
let sharedFetchPromise: Promise<SharedAlertsData | null> | null = null;

export default function NotificationBell() {
  const [serviceAlerts, setServiceAlerts] = useState<ServiceAlert[]>(() => sharedAlertsCache?.serviceAlerts || []);
  const [reusableAlerts, setReusableAlerts] = useState<ReusableAlert[]>(() => sharedAlertsCache?.reusableAlerts || []);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>(() => sharedAlertsCache?.stockAlerts || []);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("ALL");

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Service Modal state
  const [selectedServiceAlert, setSelectedServiceAlert] = useState<ServiceAlert | null>(null);
  const [serviceNotes, setServiceNotes] = useState("");
  const [markingService, setMarkingService] = useState(false);

  // Reusable Renewal Modal state
  const [selectedReusableAlert, setSelectedReusableAlert] = useState<ReusableAlert | null>(null);
  const [renewDays, setRenewDays] = useState("30");
  const [renewNotes, setRenewNotes] = useState("");
  const [renewing, setRenewing] = useState(false);

  // Returning state
  const [returningItem, setReturningItem] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchAlerts(force = false) {
    if (!force && sharedAlertsCache) {
      setServiceAlerts(sharedAlertsCache.serviceAlerts);
      setReusableAlerts(sharedAlertsCache.reusableAlerts);
      setStockAlerts(sharedAlertsCache.stockAlerts);
      return;
    }

    try {
      if (!sharedAlertsCache) setLoading(true);

      if (!sharedFetchPromise) {
        sharedFetchPromise = fetch("/api/dashboard", { cache: "no-store" })
          .then((res) => res.json())
          .then((json) => {
            if (json.success && json.data) {
              const data = {
                serviceAlerts: json.data.serviceAlerts || [],
                reusableAlerts: json.data.reusableAlerts || [],
                stockAlerts: json.data.stockAlerts || [],
              };
              sharedAlertsCache = data;
              return data;
            }
            return null;
          })
          .finally(() => {
            sharedFetchPromise = null;
          });
      }

      const res = await sharedFetchPromise;
      if (res) {
        setServiceAlerts(res.serviceAlerts);
        setReusableAlerts(res.reusableAlerts);
        setStockAlerts(res.stockAlerts);
      }
    } catch (err) {
      console.error("Failed to fetch notification alerts:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAlerts();

    const timer = setInterval(() => {
      void fetchAlerts();
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkServiceDone() {
    if (!selectedServiceAlert) return;
    setMarkingService(true);
    try {
      const res = await fetch(`/api/employee-issues/${selectedServiceAlert.issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIndex: selectedServiceAlert.itemIndex,
          action: "COMPLETE_SERVICE",
          serviceNotes: serviceNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSelectedServiceAlert(null);
        setServiceNotes("");
        await fetchAlerts();
      } else {
        setWarningMessage(data.message || "Failed to update service status");
        setWarningOpen(true);
      }
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setMarkingService(false);
    }
  }

  async function handleRenewItem() {
    if (!selectedReusableAlert) return;
    setRenewing(true);
    try {
      const res = await fetch(`/api/employee-issues/${selectedReusableAlert.issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIndex: selectedReusableAlert.itemIndex,
          action: "RENEW_ITEM",
          extendedDays: Math.max(1, Number(renewDays) || 30),
          serviceNotes: renewNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSelectedReusableAlert(null);
        setRenewNotes("");
        setRenewDays("30");
        await fetchAlerts();
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

  async function handleReturnItem(alertTarget: ReusableAlert) {
    if (!confirm(`Return "${alertTarget.productName}" from ${alertTarget.employeeName} back to warehouse inventory?`)) {
      return;
    }
    setReturningItem(true);
    try {
      const res = await fetch(`/api/employee-issues/${alertTarget.issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIndex: alertTarget.itemIndex,
          action: "RETURN",
          serviceNotes: "Returned via Notification Center",
        }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchAlerts();
      } else {
        setWarningMessage(data.message || "Failed to return item");
        setWarningOpen(true);
      }
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setReturningItem(false);
    }
  }

  const totalCount = serviceAlerts.length + reusableAlerts.length + stockAlerts.length;

  return (
    <div ref={dropdownRef} className="relative inline-block">
      {/* 🔔 Permanent Bell Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 active:scale-95 shadow-xs"
        title="Notifications Center"
      >
        <Bell className={`h-4 w-4 ${totalCount > 0 ? "text-amber-600" : "text-slate-500"}`} />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white shadow-xs animate-pulse">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>

      {/* 📋 Responsive Notification Drawer */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-2xs md:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-x-3 top-14 z-50 mx-auto max-w-sm sm:max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:absolute md:inset-auto md:left-0 md:top-full md:mt-2 md:w-[420px] md:max-w-none animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-600" />
                <span className="font-bold text-sm text-slate-800">Notifications</span>
                {totalCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-800">
                    {totalCount} Alerts
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Link
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5 mr-1"
                >
                  Dashboard <ArrowRight className="h-3 w-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="mt-2 flex gap-1 border-b border-slate-100 pb-2 overflow-x-auto text-[11px]">
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition shrink-0 ${
                  activeTab === "ALL"
                    ? "bg-slate-800 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("REUSABLE")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition shrink-0 ${
                  activeTab === "REUSABLE"
                    ? "bg-indigo-600 text-white"
                    : "text-indigo-700 hover:bg-indigo-50"
                }`}
              >
                Return/Renew ({reusableAlerts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("STOCK")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition shrink-0 ${
                  activeTab === "STOCK"
                    ? "bg-amber-600 text-white"
                    : "text-amber-700 hover:bg-amber-50"
                }`}
              >
                Stock ({stockAlerts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("SERVICE")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition shrink-0 ${
                  activeTab === "SERVICE"
                    ? "bg-blue-600 text-white"
                    : "text-blue-700 hover:bg-blue-50"
                }`}
              >
                Service ({serviceAlerts.length})
              </button>
            </div>

            {/* Alerts List */}
            <div className="mt-2.5 max-h-80 space-y-2.5 overflow-y-auto pr-1 text-xs">
              {/* 1. Reusable Return / Renewal Alerts */}
              {(activeTab === "ALL" || activeTab === "REUSABLE") &&
                reusableAlerts.map((alert, idx) => (
                  <div
                    key={`reusable-${alert.issueId}-${alert.itemIndex}-${idx}`}
                    className={`rounded-xl p-3 border transition ${
                      alert.isOverdue
                        ? "bg-red-50/80 border-red-200 text-red-950"
                        : "bg-indigo-50/70 border-indigo-200 text-indigo-950"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                            Returnable Due
                          </span>
                          <span className="font-bold text-slate-800 truncate text-xs">
                            {alert.productName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Holder: <b>{alert.employeeName}</b> {alert.employeeDepartment && `(${alert.employeeDepartment})`}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          alert.isOverdue
                            ? "bg-red-600 text-white"
                            : "bg-indigo-700 text-white"
                        }`}
                      >
                        {alert.isOverdue
                          ? `OVERDUE (${Math.abs(alert.daysRemaining)}d)`
                          : `${alert.daysRemaining} DAYS LEFT`}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600 pt-1.5 border-t border-slate-200/60">
                      <span>
                        Due: <b>{new Date(alert.returnDueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</b>
                        {alert.renewalCount > 0 && ` • Renewed ${alert.renewalCount}x`}
                      </span>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReusableAlert(alert);
                            setRenewDays(alert.returnDueDays?.toString() || "30");
                            setRenewNotes("");
                          }}
                          className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-700 active:scale-95 flex items-center gap-0.5"
                        >
                          <RotateCcw className="h-3 w-3" /> Renew
                        </button>
                        <button
                          type="button"
                          disabled={returningItem}
                          onClick={() => handleReturnItem(alert)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 active:scale-95"
                        >
                          Return
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* 2. Stock Alerts (Low Stock / Out of Stock) */}
              {(activeTab === "ALL" || activeTab === "STOCK") &&
                stockAlerts.map((stock) => (
                  <div
                    key={`stock-${stock.id}`}
                    className={`rounded-xl p-3 border transition hover:shadow-xs ${
                      stock.status === "OUT_OF_STOCK"
                        ? "bg-red-50/70 border-red-200"
                        : "bg-amber-50/70 border-amber-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white uppercase ${
                              stock.status === "OUT_OF_STOCK" ? "bg-red-600" : "bg-amber-600"
                            }`}
                          >
                            {stock.status.replace("_", " ")}
                          </span>
                          <span className="font-bold text-slate-800 truncate text-xs">
                            {stock.productName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Location: <b>{stock.warehouseName}</b> • {stock.rackName}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          stock.status === "OUT_OF_STOCK"
                            ? "bg-red-600 text-white"
                            : "bg-amber-600 text-white"
                        }`}
                      >
                        {stock.quantity === 0 ? "0 LEFT" : `${stock.quantity} UNITS LEFT`}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200/50 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">SKU: {stock.sku}</span>
                      <Link
                        href={`/inventory?productId=${stock.productId}&warehouseId=${stock.warehouseId}&rackId=${stock.rackId}&restock=true`}
                        onClick={() => setIsOpen(false)}
                        className="rounded-md bg-white border border-slate-300 px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 transition shadow-2xs flex items-center gap-1"
                      >
                        Restock Inventory →
                      </Link>
                    </div>
                  </div>
                ))}

              {/* 3. Service Maintenance Alerts */}
              {(activeTab === "ALL" || activeTab === "SERVICE") &&
                serviceAlerts.map((alert, idx) => (
                  <div
                    key={`service-${alert.issueId}-${alert.itemIndex}-${idx}`}
                    onClick={() => setSelectedServiceAlert(alert)}
                    className={`cursor-pointer rounded-xl p-3 border transition hover:shadow-xs ${
                      alert.isOverdue
                        ? "bg-red-50/70 border-red-200 hover:bg-red-50"
                        : "bg-blue-50/70 border-blue-200 hover:bg-blue-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                            Service Due
                          </span>
                          <span className="font-bold text-slate-800 text-xs truncate">
                            {alert.productName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Holder: <b>{alert.employeeName}</b> ({alert.employeeDepartment})
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          alert.isOverdue
                            ? "bg-red-600 text-white"
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        {alert.isOverdue ? "OVERDUE" : "DUE SOON"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 pt-1.5 border-t border-slate-200/40">
                      <span className="font-semibold text-slate-700">{alert.serviceStage}</span>
                      <span>
                        {alert.isOverdue
                          ? `Overdue by ${Math.abs(alert.daysRemaining)}d`
                          : `${alert.daysRemaining} days left`}
                      </span>
                    </div>
                  </div>
                ))}

              {/* Empty state */}
              {totalCount === 0 && (
                <div className="py-8 text-center space-y-1.5">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-slate-700 text-xs">All clear & up to date!</p>
                  <p className="text-[11px] text-slate-400">
                    No returnable items expiring, no low stocks, and no overdue services.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-2.5 border-t border-slate-100 pt-2 flex justify-between items-center text-[11px]">
              <Link
                href="/employee-issues"
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-blue-600 font-medium"
              >
                Employee Issues
              </Link>
              <button
                type="button"
                onClick={() => void fetchAlerts()}
                className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
          </div>
        </>
      )}

      {/* 🔄 Reusable Renewal Modal */}
      {selectedReusableAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-indigo-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">Renew Returnable Period</h3>
                  <p className="text-xs text-slate-400">Issue #{selectedReusableAlert.issueNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReusableAlert(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee:</span>
                <span className="font-bold text-slate-800">
                  {selectedReusableAlert.employeeName} ({selectedReusableAlert.employeeDepartment})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Product:</span>
                <span className="font-bold text-slate-800">{selectedReusableAlert.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Due Date:</span>
                <span className="font-bold text-slate-800">
                  {new Date(selectedReusableAlert.returnDueDate).toLocaleDateString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Status:</span>
                <span
                  className={`font-extrabold ${
                    selectedReusableAlert.isOverdue ? "text-red-600" : "text-amber-600"
                  }`}
                >
                  {selectedReusableAlert.isOverdue
                    ? `Overdue by ${Math.abs(selectedReusableAlert.daysRemaining)} days`
                    : `${selectedReusableAlert.daysRemaining} days remaining`}
                </span>
              </div>
            </div>

            {/* Renewal Days Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Extend Period by (Days) *
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  value={renewDays}
                  onChange={(e) => setRenewDays(e.target.value)}
                  className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-indigo-600"
                />
                <span className="text-xs text-slate-500">Days</span>
                <div className="flex flex-wrap gap-1 ml-auto">
                  {[7, 15, 30, 60, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setRenewDays(d.toString())}
                      className={`rounded-md px-2 py-1 text-[11px] font-semibold border ${
                        renewDays === d.toString()
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      +{d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Renewal Remarks / Purpose (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Project extended by 30 days..."
                value={renewNotes}
                onChange={(e) => setRenewNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-indigo-600"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={renewing}
                onClick={handleRenewItem}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {renewing ? "Renewing..." : `✓ Renew Period for +${renewDays} Days`}
              </button>
              <button
                type="button"
                onClick={() => setSelectedReusableAlert(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ Service Completion Modal */}
      {selectedServiceAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">Service Due Details</h3>
                  <p className="text-xs text-slate-400">Issue #{selectedServiceAlert.issueNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedServiceAlert(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee:</span>
                <span className="font-bold text-slate-800">
                  {selectedServiceAlert.employeeName} ({selectedServiceAlert.employeeDepartment})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Product:</span>
                <span className="font-bold text-slate-800">{selectedServiceAlert.productName}</span>
              </div>
              {selectedServiceAlert.serialNumber && selectedServiceAlert.serialNumber !== "-" && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Serial No:</span>
                  <span className="font-semibold text-blue-700">{selectedServiceAlert.serialNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Service Stage:</span>
                <span className="font-bold text-amber-700">{selectedServiceAlert.serviceStage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date:</span>
                <span className="font-bold text-slate-800">
                  {new Date(selectedServiceAlert.serviceDate).toLocaleDateString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-extrabold text-emerald-700">
                  {selectedServiceAlert.holdingStatus}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Service Notes / Remarks (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Enter technician remarks..."
                value={serviceNotes}
                onChange={(e) => setServiceNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={markingService}
                onClick={handleMarkServiceDone}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
              >
                {markingService ? "Saving..." : "✓ Complete Service & Schedule Next Cycle"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedServiceAlert(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
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
  );
}
