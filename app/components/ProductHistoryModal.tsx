"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Box,
  X,
  Warehouse,
  Users,
  ArrowLeftRight,
  History,
  RotateCcw,
  Calendar,
  AlertTriangle,
  Tag,
  CheckCircle2,
  Clock,
  Shield,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface ProductHistoryData {
  product: {
    id: string;
    name: string;
    sku: string;
    category?: string;
    price?: number;
    unit?: string;
    description?: string;
    productType?: "REUSABLE" | "NON_REUSABLE";
    returnDays?: number;
    warrantyMonths?: number;
    sellerName?: string;
    sellerEmail?: string;
    sellerPhone?: string;
    createdAt?: string;
  };
  summary: {
    totalInStock: number;
    totalUnitsActiveIssued: number;
    totalUnitsReturned: number;
    totalMovementRecords: number;
    totalHolders: number;
  };
  inventoryLocations: Array<{
    id: string;
    warehouse?: { _id: string; name: string; code: string; address?: string };
    rack?: { _id: string; name: string; code: string };
    quantity: number;
    status: string;
    updatedAt?: string;
  }>;
  employeeHolders: Array<{
    issueId: string;
    issueNumber: string;
    issueDate: string;
    employeeId?: string;
    employeeName: string;
    employeeDepartment?: string;
    employeePhone?: string;
    employeeEmail?: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
    serialNumber?: string;
    warehouseName: string;
    rackName: string;
    holdingStatus: string;
    returnDueDate?: string;
    lastServiceDate?: string;
    serviceCount?: number;
    returnedAt?: string;
    serviceNotes?: string;
  }>;
  movements: Array<{
    id: string;
    movementType: "INWARD" | "OUTWARD";
    reason: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
    warehouseName?: string;
    rackName?: string;
    serialNumber?: string;
    referenceNumber?: string;
    entityName?: string;
    notes?: string;
    performedByName?: string;
    createdAt: string;
  }>;
  changeLogs: Array<{
    _id: string;
    action: string;
    changedBy?: { name?: string; email?: string };
    changedFields?: string[];
    createdAt: string;
  }>;
}

interface ProductHistoryModalProps {
  productId: string | null;
  onClose: () => void;
  onSelectEmployee?: (employeeIdOrName: string) => void;
}

export default function ProductHistoryModal({
  productId,
  onClose,
  onSelectEmployee,
}: ProductHistoryModalProps) {
  const [data, setData] = useState<ProductHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "LOCATIONS" | "HOLDERS" | "MOVEMENTS" | "AUDIT"
  >("HOLDERS");

  useEffect(() => {
    if (!productId) {
      setData(null);
      return;
    }

    async function fetchProductHistory() {
      try {
        setLoading(true);
        const res = await fetch(`/api/history/product/${productId}`);
        const result = await res.json();
        if (result.success) {
          setData(result.data);
          // Set initial tab based on presence of holders
          if (result.data.employeeHolders?.length > 0) {
            setActiveTab("HOLDERS");
          } else {
            setActiveTab("LOCATIONS");
          }
        }
      } catch (err) {
        console.error("Failed to load product history:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchProductHistory();
  }, [productId]);

  if (!productId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shrink-0 shadow-sm">
              <Box className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">
                  {loading
                    ? "Loading Product History..."
                    : data?.product.name || "Product History"}
                </h2>
                {data?.product.productType === "REUSABLE" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                    <RotateCcw className="h-3 w-3" /> Reusable ({data.product.returnDays || 30}d)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>SKU: <b className="text-slate-700">{data?.product.sku || "-"}</b></span>
                {data?.product.category && (
                  <span>• Category: <b className="text-slate-700">{data.product.category}</b></span>
                )}
                {data?.product.price != null && data.product.price > 0 && (
                  <span>• Price: <b className="text-slate-700">₹{data.product.price.toLocaleString("en-IN")}</b></span>
                )}
                {data?.product.warrantyMonths ? (
                  <span>• Warranty: <b className="text-slate-700">{data.product.warrantyMonths}m</b></span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/product-history/${productId}`}
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition shadow-2xs"
              title="Open full dedicated product page"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Full Page
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-xs font-semibold text-slate-500">
              Retrieving full top-to-bottom product history...
            </p>
          </div>
        )}

        {/* Content */}
        {!loading && data && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Top Stat Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-emerald-50/40 p-3 shadow-2xs">
                <p className="text-[11px] font-semibold text-emerald-700 uppercase">Available In Stock</p>
                <p className="text-xl font-extrabold text-emerald-800 mt-1">
                  {data.summary.totalInStock} <span className="text-xs font-normal text-emerald-600">units</span>
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  Across {data.inventoryLocations.length} locations
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-blue-50/40 p-3 shadow-2xs">
                <p className="text-[11px] font-semibold text-blue-700 uppercase">Currently Issued</p>
                <p className="text-xl font-extrabold text-blue-800 mt-1">
                  {data.summary.totalUnitsActiveIssued} <span className="text-xs font-normal text-blue-600">units</span>
                </p>
                <p className="text-[10px] text-blue-600 mt-0.5">
                  With active employees
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-indigo-50/40 p-3 shadow-2xs">
                <p className="text-[11px] font-semibold text-indigo-700 uppercase">Returned Archive</p>
                <p className="text-xl font-extrabold text-indigo-800 mt-1">
                  {data.summary.totalUnitsReturned} <span className="text-xs font-normal text-indigo-600">units</span>
                </p>
                <p className="text-[10px] text-indigo-600 mt-0.5">
                  Returned to inventory
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-2xs">
                <p className="text-[11px] font-semibold text-slate-600 uppercase">Movement Logs</p>
                <p className="text-xl font-extrabold text-slate-800 mt-1">
                  {data.summary.totalMovementRecords} <span className="text-xs font-normal text-slate-500">entries</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Inward & Outward events
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("HOLDERS")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  activeTab === "HOLDERS"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Employee Holders ({data.employeeHolders.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("LOCATIONS")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  activeTab === "LOCATIONS"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Warehouse className="h-3.5 w-3.5" />
                Warehouse Stock ({data.inventoryLocations.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("MOVEMENTS")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  activeTab === "MOVEMENTS"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Movement Log ({data.movements.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("AUDIT")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  activeTab === "AUDIT"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <History className="h-3.5 w-3.5" />
                Audit Changes ({data.changeLogs.length})
              </button>
            </div>

            {/* TAB 1: EMPLOYEE HOLDERS */}
            {activeTab === "HOLDERS" && (
              <div className="space-y-3">
                {data.employeeHolders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No employee issues recorded for this product yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Employee Holder</th>
                          <th className="p-3">Issue # & Date</th>
                          <th className="p-3">Qty & Serial</th>
                          <th className="p-3">Holding Status</th>
                          <th className="p-3">Return / Service Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {data.employeeHolders.map((holder, idx) => {
                          const dateStr = new Date(holder.issueDate).toLocaleDateString(
                            "en-IN",
                            { day: "2-digit", month: "short", year: "numeric" }
                          );

                          return (
                            <tr key={`${holder.issueId}-${idx}`} className="hover:bg-slate-50/60">
                              <td className="p-3">
                                {onSelectEmployee ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSelectEmployee(holder.employeeId || holder.employeeName)
                                    }
                                    className="font-bold text-blue-600 hover:underline text-left block"
                                  >
                                    {holder.employeeName}
                                  </button>
                                ) : (
                                  <span className="font-bold text-slate-800">
                                    {holder.employeeName}
                                  </span>
                                )}
                                <p className="text-[11px] text-slate-400">
                                  {holder.employeeDepartment || "General"} {holder.employeePhone ? `• ${holder.employeePhone}` : ""}
                                </p>
                              </td>
                              <td className="p-3">
                                <span className="font-mono font-semibold text-slate-700">
                                  {holder.issueNumber}
                                </span>
                                <p className="text-[11px] text-slate-400">{dateStr}</p>
                              </td>
                              <td className="p-3">
                                <p className="font-bold text-slate-800">
                                  {holder.quantity} units
                                </p>
                                {holder.serialNumber && (
                                  <p className="text-[10px] font-mono text-slate-500">
                                    SN: {holder.serialNumber}
                                  </p>
                                )}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    holder.holdingStatus === "ACTIVE"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : holder.holdingStatus === "RETURNED"
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : holder.holdingStatus === "UNDER_SERVICE"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-slate-100 text-slate-600 border border-slate-200"
                                  }`}
                                >
                                  {holder.holdingStatus}
                                </span>
                              </td>
                              <td className="p-3">
                                {holder.holdingStatus === "RETURNED" ? (
                                  <span className="text-slate-400 text-[11px]">
                                    Returned on{" "}
                                    {holder.returnedAt
                                      ? new Date(holder.returnedAt).toLocaleDateString("en-IN")
                                      : "-"}
                                  </span>
                                ) : holder.returnDueDate ? (
                                  <div>
                                    <p className="font-bold text-slate-800 text-[11px]">
                                      {new Date(holder.returnDueDate).toLocaleDateString("en-IN")}
                                    </p>
                                    {holder.serviceCount != null && holder.serviceCount > 0 && (
                                      <span className="text-[10px] text-indigo-600 font-semibold block">
                                        Services done: {holder.serviceCount}x
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">Standard Issue</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: WAREHOUSE & RACK LOCATIONS */}
            {activeTab === "LOCATIONS" && (
              <div className="space-y-3">
                {data.inventoryLocations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No active stock locations for this product.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Warehouse</th>
                          <th className="p-3">Rack Location</th>
                          <th className="p-3 text-center">In-Stock Quantity</th>
                          <th className="p-3">Stock Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {data.inventoryLocations.map((loc) => (
                          <tr key={loc.id} className="hover:bg-slate-50/60">
                            <td className="p-3">
                              <p className="font-bold text-slate-800">
                                {loc.warehouse?.name || "Main Warehouse"}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                Code: {loc.warehouse?.code || "-"}
                              </p>
                            </td>
                            <td className="p-3">
                              <p className="font-semibold text-slate-800">
                                {loc.rack?.name || "Unassigned"}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                Rack Code: {loc.rack?.code || "-"}
                              </p>
                            </td>
                            <td className="p-3 text-center">
                              <span className="text-base font-extrabold text-slate-900">
                                {loc.quantity}
                              </span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                  loc.status === "AVAILABLE"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : loc.status === "LOW_STOCK"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {loc.status.replace("_", " ")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: STOCK MOVEMENTS */}
            {activeTab === "MOVEMENTS" && (
              <div className="space-y-3">
                {data.movements.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No movement events logged for this product.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Type / Event</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3">Location</th>
                          <th className="p-3">Reference / Handled By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {data.movements.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/60">
                            <td className="p-3 text-slate-500 text-[11px]">
                              {new Date(m.createdAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    m.movementType === "INWARD"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  {m.movementType}
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {m.reason.replace("_", " ")}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-800">
                              {m.quantity}
                            </td>
                            <td className="p-3 text-slate-600 text-[11px]">
                              {m.warehouseName || "-"} {m.rackName ? `(${m.rackName})` : ""}
                            </td>
                            <td className="p-3">
                              <p className="font-semibold text-slate-700">
                                {m.entityName || m.referenceNumber || "-"}
                              </p>
                              {m.performedByName && (
                                <p className="text-[10px] text-slate-400">
                                  By: {m.performedByName}
                                </p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: AUDIT LOG */}
            {activeTab === "AUDIT" && (
              <div className="space-y-3">
                {data.changeLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No change records found.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.changeLogs.map((log) => (
                      <div
                        key={log._id}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{log.action}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(log.createdAt).toLocaleString("en-IN")}
                            </span>
                          </div>
                          {log.changedFields && log.changedFields.length > 0 && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              Modified fields: {log.changedFields.join(", ")}
                            </p>
                          )}
                        </div>
                        <span className="text-slate-500 text-[11px]">
                          {log.changedBy?.name || "Administrator"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
