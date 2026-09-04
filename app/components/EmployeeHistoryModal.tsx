"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  User,
  X,
  Package,
  RotateCcw,
  Wrench,
  Receipt,
  Calendar,
  AlertTriangle,
  Building2,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface EmployeeHistoryData {
  employee: {
    id: string;
    employeeCode: string;
    name: string;
    department: string;
    designation: string;
    email?: string;
    phone?: string;
    warehouse?: { name: string; code: string };
    status?: string;
  };
  summary: {
    totalIssuesCount: number;
    activeUnitsCount: number;
    returnedUnitsCount: number;
    totalActiveValue: number;
    overdueCount: number;
    upcomingServicesCount: number;
    servicesCompletedCount: number;
  };
  activeAssets: Array<{
    issueId: string;
    issueNumber: string;
    itemIndex: number;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
    serialNumber?: string;
    warehouseName: string;
    rackName: string;
    productType?: string;
    returnDueDays?: number;
    returnDueDate?: string;
    daysRemaining?: number;
    isOverdue?: boolean;
    serviceIntervalMonths?: number;
    lastServiceDate?: string;
    nextServiceDate?: string;
    serviceStage?: string;
    isServiceDue?: boolean;
    isServiceOverdue?: boolean;
    serviceCount?: number;
    holdingStatus: string;
    issuedAt: string;
  }>;
  returnedAssets: Array<{
    issueId: string;
    issueNumber: string;
    itemIndex: number;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    serialNumber?: string;
    warehouseName: string;
    rackName: string;
    issuedAt: string;
    returnedAt?: string;
    serviceCount?: number;
    totalValue: number;
  }>;
  issueSlips: Array<{
    id: string;
    issueNumber: string;
    date: string;
    reason: string;
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
    notes?: string;
    issuedByName?: string;
  }>;
  serviceHistory: Array<{
    issueId: string;
    issueNumber: string;
    productName: string;
    sku: string;
    serialNumber?: string;
    serviceNumber: number;
    completedAt: string;
    notes?: string;
    performedBy?: string;
  }>;
}

interface EmployeeHistoryModalProps {
  employeeIdOrName: string | null;
  onClose: () => void;
  onSelectProduct?: (productId: string) => void;
  onViewBill?: (issueId: string) => void;
}

export default function EmployeeHistoryModal({
  employeeIdOrName,
  onClose,
  onSelectProduct,
  onViewBill,
}: EmployeeHistoryModalProps) {
  const [data, setData] = useState<EmployeeHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "ACTIVE" | "RETURNED" | "SLIPS" | "SERVICES"
  >("ACTIVE");

  useEffect(() => {
    if (!employeeIdOrName) {
      setData(null);
      return;
    }

    async function fetchEmployeeHistory() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/history/employee/${encodeURIComponent(employeeIdOrName as string)}`
        );
        const result = await res.json();
        if (result.success) {
          setData(result.data);
          if (result.data.activeAssets?.length > 0) {
            setActiveTab("ACTIVE");
          } else if (result.data.returnedAssets?.length > 0) {
            setActiveTab("RETURNED");
          } else {
            setActiveTab("SLIPS");
          }
        }
      } catch (err) {
        console.error("Failed to load employee history:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchEmployeeHistory();
  }, [employeeIdOrName]);

  if (!employeeIdOrName) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-base shrink-0 shadow-sm">
              {data?.employee.name
                ? data.employee.name.slice(0, 1).toUpperCase()
                : "E"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">
                  {loading
                    ? "Loading Employee History..."
                    : data?.employee.name || "Employee Asset History"}
                </h2>
                {data?.employee.employeeCode && (
                  <span className="font-mono bg-slate-200 text-slate-800 rounded px-1.5 py-0.2 text-xs font-bold">
                    {data.employee.employeeCode}
                  </span>
                )}
                {data?.summary.overdueCount ? (
                  <span className="rounded-full bg-red-600 text-white px-2 py-0.5 text-[10px] font-extrabold animate-pulse">
                    {data.summary.overdueCount} Overdue
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Dept: <b className="text-slate-700">{data?.employee.department || "General"}</b></span>
                {data?.employee.designation && (
                  <span>• {data.employee.designation}</span>
                )}
                {data?.employee.phone && (
                  <span>• Tel: <b className="text-slate-700">{data.employee.phone}</b></span>
                )}
                {data?.employee.warehouse && (
                  <span>• Base: <b className="text-slate-700">{data.employee.warehouse.name}</b></span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {employeeIdOrName && (
              <Link
                href={`/employee-issues/employee/${encodeURIComponent(employeeIdOrName)}`}
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition shadow-2xs"
                title="Open full dedicated employee custody page"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Full Page
              </Link>
            )}
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
              Retrieving full employee assets & issue history...
            </p>
          </div>
        )}

        {/* Content */}
        {!loading && data && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Top Stat Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-blue-50/40 p-3 shadow-2xs">
                <p className="text-[11px] font-semibold text-blue-700 uppercase">Active Units Held</p>
                <p className="text-xl font-extrabold text-blue-800 mt-1">
                  {data.summary.activeUnitsCount} <span className="text-xs font-normal text-blue-600">units</span>
                </p>
                <p className="text-[10px] text-blue-600 mt-0.5">
                  Across {data.activeAssets.length} distinct items
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-emerald-50/40 p-3 shadow-2xs">
                <p className="text-[11px] font-semibold text-emerald-700 uppercase">Total Returned</p>
                <p className="text-xl font-extrabold text-emerald-800 mt-1">
                  {data.summary.returnedUnitsCount} <span className="text-xs font-normal text-emerald-600">units</span>
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  Restored to warehouse
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-indigo-50/40 p-3 shadow-2xs">
                <p className="text-[11px] font-semibold text-indigo-700 uppercase">Active Valuation</p>
                <p className="text-xl font-extrabold text-indigo-800 mt-1">
                  {data.summary.totalActiveValue > 0
                    ? `₹${data.summary.totalActiveValue.toLocaleString("en-IN")}`
                    : "N/A"}
                </p>
                <p className="text-[10px] text-indigo-600 mt-0.5">
                  Equipment value in custody
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-2xs">
                <p className="text-[11px] font-semibold text-slate-600 uppercase">Total Issue Slips</p>
                <p className="text-xl font-extrabold text-slate-800 mt-1">
                  {data.summary.totalIssuesCount} <span className="text-xs font-normal text-slate-500">vouchers</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {data.summary.servicesCompletedCount} maintenance events
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("ACTIVE")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  activeTab === "ACTIVE"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                Active Assets Held ({data.activeAssets.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("RETURNED")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  activeTab === "RETURNED"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Returned Archive ({data.returnedAssets.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("SLIPS")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  activeTab === "SLIPS"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Receipt className="h-3.5 w-3.5" />
                Issue Vouchers & Bills ({data.issueSlips.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("SERVICES")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  activeTab === "SERVICES"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Wrench className="h-3.5 w-3.5" />
                Maintenance Log ({data.serviceHistory.length})
              </button>
            </div>

            {/* TAB 1: ACTIVE ASSETS HELD */}
            {activeTab === "ACTIVE" && (
              <div className="space-y-3">
                {data.activeAssets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No active assets currently held by this employee.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Product / Asset</th>
                          <th className="p-3">Quantity & SN</th>
                          <th className="p-3">Location</th>
                          <th className="p-3">Return Status</th>
                          <th className="p-3">Maintenance Cycle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {data.activeAssets.map((asset, idx) => (
                          <tr
                            key={`${asset.issueId}-${idx}`}
                            className={`hover:bg-slate-50/60 ${
                              asset.isOverdue ? "bg-red-50/20" : ""
                            }`}
                          >
                            <td className="p-3">
                              {onSelectProduct ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectProduct(asset.productId)}
                                  className="font-bold text-blue-600 hover:underline text-left block"
                                >
                                  {asset.productName}
                                </button>
                              ) : (
                                <p className="font-bold text-slate-800">{asset.productName}</p>
                              )}
                              <p className="text-[11px] text-slate-400">SKU: {asset.sku}</p>
                            </td>
                            <td className="p-3">
                              <p className="font-bold text-slate-800">{asset.quantity} units</p>
                              {asset.serialNumber && (
                                <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[10px] text-slate-700">
                                  SN: {asset.serialNumber}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-600">
                              <p className="font-semibold text-slate-800">{asset.rackName}</p>
                              <p className="text-[10px] text-slate-400">{asset.warehouseName}</p>
                            </td>
                            <td className="p-3">
                              {asset.returnDueDate ? (
                                <div>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                      asset.isOverdue
                                        ? "bg-red-600 text-white"
                                        : "bg-indigo-600 text-white"
                                    }`}
                                  >
                                    {asset.isOverdue
                                      ? `OVERDUE (${Math.abs(asset.daysRemaining || 0)}d)`
                                      : `${asset.daysRemaining}d remaining`}
                                  </span>
                                  <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">
                                    Due: {new Date(asset.returnDueDate).toLocaleDateString("en-IN")}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Standard Issue</span>
                              )}
                            </td>
                            <td className="p-3">
                              {asset.serviceIntervalMonths ? (
                                <div>
                                  <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                    {asset.serviceStage || `${asset.serviceIntervalMonths}m cycle`}
                                  </span>
                                  {asset.serviceCount != null && asset.serviceCount > 0 && (
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                      Done: {asset.serviceCount}x
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
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

            {/* TAB 2: RETURNED ASSETS ARCHIVE */}
            {activeTab === "RETURNED" && (
              <div className="space-y-3">
                {data.returnedAssets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No returned assets recorded for this employee.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Product Name</th>
                          <th className="p-3">Qty & SN</th>
                          <th className="p-3">Issue Date</th>
                          <th className="p-3">Returned Date</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {data.returnedAssets.map((asset, idx) => (
                          <tr key={`${asset.issueId}-${idx}`} className="hover:bg-slate-50/60">
                            <td className="p-3">
                              {onSelectProduct ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectProduct(asset.productId)}
                                  className="font-bold text-blue-600 hover:underline text-left block"
                                >
                                  {asset.productName}
                                </button>
                              ) : (
                                <p className="font-bold text-slate-800">{asset.productName}</p>
                              )}
                              <p className="text-[11px] text-slate-400">SKU: {asset.sku}</p>
                            </td>
                            <td className="p-3">
                              <p className="font-bold text-slate-800">{asset.quantity} units</p>
                              {asset.serialNumber && (
                                <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[10px] text-slate-700">
                                  SN: {asset.serialNumber}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-500 text-[11px]">
                              {new Date(asset.issuedAt).toLocaleDateString("en-IN")}
                            </td>
                            <td className="p-3 text-slate-700 font-semibold text-[11px]">
                              {asset.returnedAt
                                ? new Date(asset.returnedAt).toLocaleDateString("en-IN")
                                : "-"}
                            </td>
                            <td className="p-3">
                              <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                RETURNED
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

            {/* TAB 3: ISSUE VOUCHERS */}
            {activeTab === "SLIPS" && (
              <div className="space-y-3">
                {data.issueSlips.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No issue vouchers recorded.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.issueSlips.map((slip) => (
                      <div
                        key={slip.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-blue-400 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-slate-800">
                              {slip.issueNumber}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                              {slip.reason.replace("_", " ")}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(slip.date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Total Units: <b className="text-slate-700">{slip.totalQuantity}</b>
                            {slip.totalValue > 0 && (
                              <span> • Valuation: <b className="text-slate-700">₹{slip.totalValue.toLocaleString("en-IN")}</b></span>
                            )}
                            {slip.issuedByName && (
                              <span> • Issuer: {slip.issuedByName}</span>
                            )}
                          </p>
                        </div>

                        {onViewBill && (
                          <button
                            type="button"
                            onClick={() => onViewBill(slip.id)}
                            className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition flex items-center gap-1 shrink-0 self-end sm:self-center"
                          >
                            <Receipt className="h-3.5 w-3.5" /> View Slip / Bill
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: MAINTENANCE LOG */}
            {activeTab === "SERVICES" && (
              <div className="space-y-3">
                {data.serviceHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No completed service records found for this employee.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.serviceHistory.map((s, idx) => (
                      <div
                        key={`${s.issueId}-${idx}`}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800">{s.productName}</span>
                            <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.2 text-[10px] font-bold">
                              Service #{s.serviceNumber}
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              {new Date(s.completedAt).toLocaleDateString("en-IN")}
                            </span>
                          </div>
                          {s.notes && (
                            <p className="text-slate-600 mt-1 italic">
                              Remarks: {s.notes}
                            </p>
                          )}
                        </div>
                        {s.performedBy && (
                          <span className="text-slate-500 text-[11px] shrink-0">
                            By: {s.performedBy}
                          </span>
                        )}
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
