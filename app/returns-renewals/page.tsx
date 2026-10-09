"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Calendar,
  Building2,
  Box,
  User,
  Receipt,
  Search,
  Check,
  X,
  History,
  Tag,
  ArrowRight,
  Filter,
  Eye,
  CornerDownLeft,
  PackageCheck,
  ShieldAlert,
  SlidersHorizontal,
  ChevronDown,
  Info,
  Wrench,
  CalendarDays,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import IssueBillModal, { IssueBillData } from "@/app/components/IssueBillModal";
import Pagination from "@/app/components/Pagination";
import SearchableSelect from "@/app/components/SearchableSelect";

type RenewalHistoryRecord = {
  renewalNumber: number;
  renewedAt: string;
  extendedDays: number;
  newDueDate: string;
  notes?: string;
  performedBy?: string;
};

type ReturnableItemRow = {
  issueId: string;
  issueNumber: string;
  itemIndex: number;
  employeeId?: string;
  employeeName: string;
  employeeEmail?: string;
  employeePhone?: string;
  employeeDepartment?: string;
  productId: string;
  productName: string;
  sku: string;
  serialNumber?: string;
  warehouseId?: string;
  warehouseName: string;
  rackId?: string;
  rackName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  returnDueDays?: number;
  returnDueDate?: string;
  holdingStatus: "ACTIVE" | "INACTIVE" | "UNDER_SERVICE" | "RETURNED" | "DAMAGED";
  returnedAt?: string;
  returnCondition?: string;
  renewalCount: number;
  renewalHistory: RenewalHistoryRecord[];
  lastRenewedDate?: string;
  serviceNotes?: string;
  createdAt: string;
  reason?: string;
  siteName?: string;
  issuedByName?: string;
  rawIssue: any;
  // Computed fields
  isReturned: boolean;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean;
  daysRemaining: number;
};

type WarehouseOption = {
  _id: string;
  name: string;
  code: string;
};

type RackOption = {
  _id: string;
  name: string;
  code: string;
  warehouseId: { _id?: string; name?: string } | string;
};

type EmployeeOption = {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
};

function isSameDate(dateStr?: string, targetDateYMD?: string): boolean {
  if (!dateStr || !targetDateYMD) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` === targetDateYMD;
}

function getTodayYMD(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ReturnsRenewalsPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReturnableItemRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [racks, setRacks] = useState<RackOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "OVERDUE" | "DUE_SOON" | "RENEWED" | "RETURNED" | "ALL">("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("ALL");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("ALL");
  const [selectedDate, setSelectedDate] = useState(""); // YYYY-MM-DD
  const [dateFieldFilter, setDateFieldFilter] = useState<"DUE" | "ISSUED" | "RETURNED" | "ANY">("DUE");
  const [sortBy, setSortBy] = useState<
    "URGENT" | "DUE_ASC" | "DUE_DESC" | "NEWEST" | "OLDEST" | "RETURNED_RECENT" | "EMPLOYEE"
  >("URGENT");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [selectedBillIssue, setSelectedBillIssue] = useState<IssueBillData | null>(null);
  const [renewTarget, setRenewTarget] = useState<ReturnableItemRow | null>(null);
  const [returnTarget, setReturnTarget] = useState<ReturnableItemRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<ReturnableItemRow | null>(null);

  // Toast / Status banner
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch all necessary data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [issuesRes, warehousesRes, racksRes] = await Promise.all([
        fetch("/api/employee-issues"),
        fetch("/api/warehouses"),
        fetch("/api/racks"),
      ]);

      const [issuesData, warehousesData, racksData] = await Promise.all([
        issuesRes.json(),
        warehousesRes.json(),
        racksRes.json(),
      ]);

      if (warehousesData.success && Array.isArray(warehousesData.data)) {
        setWarehouses(warehousesData.data);
      }

      if (racksData.success && Array.isArray(racksData.data)) {
        setRacks(racksData.data);
      }

      if (issuesData.success && Array.isArray(issuesData.data)) {
        if (Array.isArray(issuesData.employees)) {
          setEmployees(issuesData.employees);
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        const flatRows: ReturnableItemRow[] = [];

        issuesData.data.forEach((issue: any) => {
          if (!Array.isArray(issue.items)) return;

          issue.items.forEach((item: any, idx: number) => {
            const isReusable = item.productType === "REUSABLE" || Boolean(item.returnDueDate);
            if (!isReusable) return;

            const isReturned = item.holdingStatus === "RETURNED";
            let isOverdue = false;
            let isDueToday = false;
            let isDueSoon = false;
            let daysRemaining = 0;

            if (item.returnDueDate) {
              const dueTime = new Date(item.returnDueDate).setHours(0, 0, 0, 0);
              const diffMs = dueTime - todayStart;
              daysRemaining = Math.round(diffMs / 86400000);

              if (!isReturned) {
                if (dueTime < todayStart) {
                  isOverdue = true;
                } else if (dueTime === todayStart) {
                  isDueToday = true;
                } else if (daysRemaining <= 7) {
                  isDueSoon = true;
                }
              }
            }

            flatRows.push({
              issueId: issue._id,
              issueNumber: issue.issueNumber,
              itemIndex: idx,
              employeeId: issue.employeeId?._id || issue.employeeId,
              employeeName: issue.employeeName || "Unknown Employee",
              employeeEmail: issue.employeeEmail,
              employeePhone: issue.employeePhone,
              employeeDepartment: issue.employeeDepartment,
              productId: item.productId?._id || item.productId,
              productName: item.productName || "Product",
              sku: item.sku || "-",
              serialNumber: item.serialNumber,
              warehouseId: item.warehouseId?._id || item.warehouseId,
              warehouseName: item.warehouseName || "Warehouse",
              rackId: item.rackId?._id || item.rackId,
              rackName: item.rackName || "Rack",
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              totalValue: item.totalValue || (item.unitPrice || 0) * (item.quantity || 1),
              returnDueDays: item.returnDueDays,
              returnDueDate: item.returnDueDate,
              holdingStatus: item.holdingStatus || "ACTIVE",
              returnedAt: item.returnedAt,
              returnCondition: item.returnCondition,
              renewalCount: item.renewalCount || 0,
              renewalHistory: item.renewalHistory || [],
              lastRenewedDate: item.lastRenewedDate,
              serviceNotes: item.serviceNotes,
              createdAt: issue.createdAt,
              reason: issue.reason,
              siteName: issue.siteName,
              issuedByName: issue.issuedByName,
              rawIssue: issue,
              isReturned,
              isOverdue,
              isDueToday,
              isDueSoon,
              daysRemaining,
            });
          });
        });

        setItems(flatRows);
      }
    } catch (err) {
      console.error("Error loading returns & renewals data:", err);
      showToast("Failed to fetch returns data. Please refresh.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // KPI Counts
  const counts = useMemo(() => {
    let active = 0;
    let overdue = 0;
    let dueSoon = 0;
    let renewed = 0;
    let returned = 0;

    items.forEach((item) => {
      if (item.isReturned) {
        returned++;
      } else {
        active++;
        if (item.isOverdue) overdue++;
        if (item.isDueSoon || item.isDueToday) dueSoon++;
      }
      if (item.renewalCount > 0) {
        renewed++;
      }
    });

    return {
      active,
      overdue,
      dueSoon,
      renewed,
      returned,
      total: items.length,
    };
  }, [items]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Tab filtering
        if (activeTab === "ACTIVE" && item.isReturned) return false;
        if (activeTab === "OVERDUE" && (!item.isOverdue || item.isReturned)) return false;
        if (activeTab === "DUE_SOON" && (!item.isDueSoon && !item.isDueToday || item.isReturned)) return false;
        if (activeTab === "RENEWED" && item.renewalCount <= 0) return false;
        if (activeTab === "RETURNED" && !item.isReturned) return false;

        // Warehouse filtering
        if (selectedWarehouseId !== "ALL") {
          const matchWarehouse =
            item.warehouseId === selectedWarehouseId ||
            item.warehouseName.toLowerCase() === selectedWarehouseId.toLowerCase();
          if (!matchWarehouse) return false;
        }

        // Employee filtering
        if (selectedEmployeeId !== "ALL") {
          const matchEmp =
            item.employeeId === selectedEmployeeId ||
            item.employeeName.toLowerCase() === selectedEmployeeId.toLowerCase();
          if (!matchEmp) return false;
        }

        // Text search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const match =
            item.productName.toLowerCase().includes(q) ||
            item.sku.toLowerCase().includes(q) ||
            (item.serialNumber && item.serialNumber.toLowerCase().includes(q)) ||
            item.issueNumber.toLowerCase().includes(q) ||
            item.employeeName.toLowerCase().includes(q) ||
            (item.employeeDepartment && item.employeeDepartment.toLowerCase().includes(q)) ||
            (item.siteName && item.siteName.toLowerCase().includes(q)) ||
            (item.serviceNotes && item.serviceNotes.toLowerCase().includes(q));
          if (!match) return false;
        }

        // Particular Date filtering
        if (selectedDate) {
          if (dateFieldFilter === "DUE") {
            if (!isSameDate(item.returnDueDate, selectedDate)) return false;
          } else if (dateFieldFilter === "ISSUED") {
            if (!isSameDate(item.createdAt, selectedDate)) return false;
          } else if (dateFieldFilter === "RETURNED") {
            if (!isSameDate(item.returnedAt, selectedDate)) return false;
          } else {
            const matchDue = isSameDate(item.returnDueDate, selectedDate);
            const matchIssued = isSameDate(item.createdAt, selectedDate);
            const matchReturned = isSameDate(item.returnedAt, selectedDate);
            if (!matchDue && !matchIssued && !matchReturned) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "URGENT") {
          // Overdue first, then due today, then due soon, then returned last
          if (a.isReturned !== b.isReturned) return a.isReturned ? 1 : -1;
          if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
          if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === "DUE_ASC") {
          const timeA = a.returnDueDate ? new Date(a.returnDueDate).getTime() : Infinity;
          const timeB = b.returnDueDate ? new Date(b.returnDueDate).getTime() : Infinity;
          return timeA - timeB;
        }
        if (sortBy === "DUE_DESC") {
          const timeA = a.returnDueDate ? new Date(a.returnDueDate).getTime() : -Infinity;
          const timeB = b.returnDueDate ? new Date(b.returnDueDate).getTime() : -Infinity;
          return timeB - timeA;
        }
        if (sortBy === "NEWEST") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === "OLDEST") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === "RETURNED_RECENT") {
          const timeA = a.returnedAt ? new Date(a.returnedAt).getTime() : 0;
          const timeB = b.returnedAt ? new Date(b.returnedAt).getTime() : 0;
          return timeB - timeA;
        }
        if (sortBy === "EMPLOYEE") {
          return a.employeeName.localeCompare(b.employeeName);
        }
        return 0;
      });
  }, [items, activeTab, selectedWarehouseId, selectedEmployeeId, searchQuery, selectedDate, dateFieldFilter, sortBy]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Handle successful return action
  const handleReturnSuccess = (returnedRow: ReturnableItemRow, updatedData?: any) => {
    showToast(`Asset "${returnedRow.productName}" successfully returned to warehouse stock!`, "success");
    setReturnTarget(null);
    fetchData();
  };

  // Handle successful renew action
  const handleRenewSuccess = (renewedRow: ReturnableItemRow, newDueDateStr: string) => {
    showToast(`Loan for "${renewedRow.productName}" successfully extended!`, "success");
    setRenewTarget(null);
    fetchData();
  };

  // Switch tab and auto-sync date target with clicked card
  const handleSelectTab = (tab: "ACTIVE" | "OVERDUE" | "DUE_SOON" | "RENEWED" | "RETURNED" | "ALL") => {
    if (activeTab === tab) {
      setActiveTab("ALL");
      setDateFieldFilter("DUE");
    } else {
      setActiveTab(tab);
      if (tab === "RETURNED") {
        setDateFieldFilter("RETURNED");
      } else {
        setDateFieldFilter("DUE");
      }
    }
    setCurrentPage(1);
  };

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50/70 p-3 sm:p-6 lg:p-8 space-y-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl transition-all animate-in slide-in-from-top-2 duration-200 ${
              toastMessage.type === "success"
                ? "bg-emerald-600 text-white shadow-emerald-600/20"
                : "bg-red-600 text-white shadow-red-600/20"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertOctagon className="h-5 w-5" />
            )}
            <span>{toastMessage.text}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="ml-2 rounded-md p-1 hover:bg-white/20 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ─── PAGE HEADER ─── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  Returns & Renewals Hub
                </h1>
                <span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2.5 py-0.5 text-xs font-bold">
                  {counts.active} Active on Loan
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Process asset returns back into inventory, extend lending periods, and view loan history.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95 shadow-2xs"
              title="Refresh Records"
            >
              <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/employee-issues"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95 shadow-2xs"
            >
              <PackageCheck className="h-4 w-4 text-blue-600" />
              <span>User Assets</span>
            </Link>

            <Link
              href="/asset-history"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95 shadow-2xs"
            >
              <History className="h-4 w-4 text-emerald-600" />
              <span>Custody History</span>
            </Link>
          </div>
        </div>

        {/* ─── KPI SUMMARY CARDS ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Active on Loan */}
          <button
            type="button"
            onClick={() => handleSelectTab("ACTIVE")}
            className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 shadow-2xs cursor-pointer ${
              activeTab === "ACTIVE"
                ? "bg-blue-50/95 border-2 border-blue-500 ring-4 ring-blue-500/20 shadow-xs scale-[1.01]"
                : "bg-blue-50/35 border-blue-200/80 hover:bg-blue-50/70 hover:border-blue-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900/80">Active on Loan</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shadow-2xs">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-blue-950">{counts.active}</p>
            <p className="text-[11px] text-blue-700/80 mt-0.5 font-medium">Currently with staff</p>
          </button>

          {/* Card 2: Overdue Items */}
          <button
            type="button"
            onClick={() => handleSelectTab("OVERDUE")}
            className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 shadow-2xs cursor-pointer ${
              activeTab === "OVERDUE"
                ? "bg-red-50/95 border-2 border-red-500 ring-4 ring-red-500/20 shadow-xs scale-[1.01]"
                : "bg-red-50/35 border-red-200/80 hover:bg-red-50/70 hover:border-red-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-900/80">Overdue Items</span>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-red-700 shadow-2xs ${
                  counts.overdue > 0 ? "animate-pulse" : ""
                }`}
              >
                <AlertOctagon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-black text-red-950">{counts.overdue}</p>
              {counts.overdue > 0 && (
                <span className="rounded-full bg-red-600 text-white px-2 py-0.2 text-[10px] font-extrabold">
                  Action Required
                </span>
              )}
            </div>
            <p className="text-[11px] text-red-700/80 mt-0.5 font-medium">Past return deadline</p>
          </button>

          {/* Card 3: Due Soon (<= 7 days) */}
          <button
            type="button"
            onClick={() => handleSelectTab("DUE_SOON")}
            className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 shadow-2xs cursor-pointer ${
              activeTab === "DUE_SOON"
                ? "bg-amber-50/95 border-2 border-amber-500 ring-4 ring-amber-500/20 shadow-xs scale-[1.01]"
                : "bg-amber-50/35 border-amber-200/80 hover:bg-amber-50/70 hover:border-amber-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900/80">Due Soon (≤ 7d)</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-2xs">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-amber-950">{counts.dueSoon}</p>
            <p className="text-[11px] text-amber-800/80 mt-0.5 font-medium">Expiring this week</p>
          </button>

          {/* Card 4: Renewed Assets */}
          <button
            type="button"
            onClick={() => handleSelectTab("RENEWED")}
            className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 shadow-2xs cursor-pointer ${
              activeTab === "RENEWED"
                ? "bg-indigo-50/95 border-2 border-indigo-500 ring-4 ring-indigo-500/20 shadow-xs scale-[1.01]"
                : "bg-indigo-50/35 border-indigo-200/80 hover:bg-indigo-50/70 hover:border-indigo-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900/80">Renewed Loans</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 shadow-2xs">
                <RefreshCw className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-indigo-950">{counts.renewed}</p>
            <p className="text-[11px] text-indigo-700/80 mt-0.5 font-medium">Period extended</p>
          </button>

          {/* Card 5: Returned Assets */}
          <button
            type="button"
            onClick={() => handleSelectTab("RETURNED")}
            className={`col-span-2 sm:col-span-1 flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 shadow-2xs cursor-pointer ${
              activeTab === "RETURNED"
                ? "bg-emerald-50/95 border-2 border-emerald-500 ring-4 ring-emerald-500/20 shadow-xs scale-[1.01]"
                : "bg-emerald-50/35 border-emerald-200/80 hover:bg-emerald-50/70 hover:border-emerald-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900/80">Returned History</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-2xs">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-950">{counts.returned}</p>
            <p className="text-[11px] text-emerald-700/80 mt-0.5 font-medium">Restored to warehouse</p>
          </button>
        </div>

        {/* ─── CONTROLS: SEARCH & FILTERS ─── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {(activeTab !== "ALL" || selectedDate || searchQuery || selectedWarehouseId !== "ALL" || selectedEmployeeId !== "ALL") && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 text-xs flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 font-medium">Active Filters:</span>
                {activeTab !== "ALL" && (
                  <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                    <span>
                      {activeTab === "ACTIVE" && `Active on Loan (${counts.active})`}
                      {activeTab === "OVERDUE" && `Overdue Items (${counts.overdue})`}
                      {activeTab === "DUE_SOON" && `Due Soon (${counts.dueSoon})`}
                      {activeTab === "RENEWED" && `Renewed Loans (${counts.renewed})`}
                      {activeTab === "RETURNED" && `Returned History (${counts.returned})`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectTab("ALL")}
                      className="hover:text-rose-600 transition cursor-pointer"
                      title="Clear status filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedDate && (
                  <span className="inline-flex items-center gap-1 font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                    <CalendarDays className="h-3 w-3 text-indigo-600" />
                    <span>
                      {dateFieldFilter === "DUE"
                        ? "Due Date:"
                        : dateFieldFilter === "ISSUED"
                        ? "Issue Date:"
                        : dateFieldFilter === "RETURNED"
                        ? "Return Date:"
                        : "Date:"}{" "}
                      {selectedDate}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate("");
                        setCurrentPage(1);
                      }}
                      className="hover:text-rose-600 transition"
                      title="Clear date filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedWarehouseId !== "ALL" && (
                  <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                    <span>Warehouse filter</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWarehouseId("ALL");
                        setCurrentPage(1);
                      }}
                      className="hover:text-rose-600 transition"
                      title="Clear warehouse filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedEmployeeId !== "ALL" && (
                  <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                    <span>Staff filter</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeId("ALL");
                        setCurrentPage(1);
                      }}
                      className="hover:text-rose-600 transition"
                      title="Clear staff filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                    <span>"{searchQuery}"</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setCurrentPage(1);
                      }}
                      className="hover:text-rose-600 transition"
                      title="Clear search"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  handleSelectTab("ALL");
                  setSelectedDate("");
                  setSelectedWarehouseId("ALL");
                  setSelectedEmployeeId("ALL");
                  setSearchQuery("");
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer"
              >
                <span>Clear All Filters</span>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Filter and Search Bar Inputs */}
          <div className="p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search product, SKU, serial, staff, issue..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Warehouse Filter */}
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <select
                value={selectedWarehouseId}
                onChange={(e) => {
                  setSelectedWarehouseId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition font-medium text-slate-700 appearance-none cursor-pointer"
              >
                <option value="ALL">All Warehouses</option>
                {warehouses.map((wh) => (
                  <option key={wh._id} value={wh._id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Custodian / Employee Filter */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <select
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition font-medium text-slate-700 appearance-none cursor-pointer"
              >
                <option value="ALL">All Custodians / Staff</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeCode} - {emp.department})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Sort Options */}
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition font-medium text-slate-700 appearance-none cursor-pointer"
              >
                <option value="URGENT">Sort: Urgent (Overdue → Due Soon)</option>
                <option value="DUE_ASC">Sort: Due Date (Earliest first)</option>
                <option value="DUE_DESC">Sort: Due Date (Latest first)</option>
                <option value="NEWEST">Sort: Issue Date (Newest first)</option>
                <option value="OLDEST">Sort: Issue Date (Oldest first)</option>
                <option value="RETURNED_RECENT">Sort: Return Date (Recently returned)</option>
                <option value="EMPLOYEE">Sort: Staff Name (A-Z)</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Date-wise Filter & Quick Presets Strip */}
          <div className="px-3.5 sm:px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mr-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <span>Particular Date:</span>
              </div>

              {/* Date Field Target (Auto-synced with Top Cards + Manual override) */}
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-500 pointer-events-none" />
                <select
                  value={dateFieldFilter}
                  onChange={(e) => {
                    setDateFieldFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="pl-7 pr-7 py-1.5 text-xs rounded-xl border border-indigo-200/90 bg-indigo-50/60 font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs appearance-none cursor-pointer"
                  title="Auto-synced with top cards (Due Date / Return Date) or select manually"
                >
                  <option value="DUE">Due Date</option>
                  <option value="RETURNED">Return Date</option>
                  <option value="ISSUED">Issue Date</option>
                  <option value="ANY">Any Date Field</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-indigo-500 pointer-events-none" />
              </div>

              {/* Calendar Date Input */}
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs rounded-xl border font-medium transition shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer ${
                    selectedDate
                      ? "border-indigo-400 bg-indigo-50/70 text-indigo-950 font-bold"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                />
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate("");
                      setCurrentPage(1);
                    }}
                    className="ml-1.5 p-1 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    title="Clear date"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(getTodayYMD(0));
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                    selectedDate === getTodayYMD(0)
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200 shadow-2xs"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(getTodayYMD(1));
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                    selectedDate === getTodayYMD(1)
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200 shadow-2xs"
                  }`}
                >
                  Tomorrow
                </button>
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate("");
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 text-[11px] font-bold rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                  >
                    Clear Date
                  </button>
                )}
              </div>
            </div>

            {/* Active Date Counter */}
            {selectedDate && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-lg">
                <span>Matching:</span>
                <span className="font-bold">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="text-slate-500 font-normal">
                  ({filteredItems.length} {filteredItems.length === 1 ? "record" : "records"})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ─── DATA TABLE / CARDS ─── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-700">Loading returns & renewals data...</p>
              <p className="text-xs text-slate-400">Fetching custody loans, due dates, and warehouse racks.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center space-y-3 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mx-auto">
                <PackageCheck className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No matching assets found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {selectedDate
                  ? `No records found matching ${
                      dateFieldFilter === "DUE"
                        ? "due date"
                        : dateFieldFilter === "ISSUED"
                        ? "issue date"
                        : dateFieldFilter === "RETURNED"
                        ? "return date"
                        : "date"
                    } "${selectedDate}".`
                  : searchQuery || selectedWarehouseId !== "ALL" || selectedEmployeeId !== "ALL"
                  ? "Try clearing filters or search keywords to see other returnable items."
                  : activeTab === "OVERDUE"
                  ? "Great news! There are currently no overdue assets."
                  : activeTab === "DUE_SOON"
                  ? "No loans are due within the next 7 days."
                  : "No returnable items found."}
              </p>
              {(searchQuery || selectedWarehouseId !== "ALL" || selectedEmployeeId !== "ALL" || activeTab !== "ALL" || selectedDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedWarehouseId("ALL");
                    setSelectedEmployeeId("ALL");
                    setSelectedDate("");
                    handleSelectTab("ALL");
                  }}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 transition"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Responsive Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4">Asset / Product Details</th>
                      <th className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => setSortBy(sortBy === "EMPLOYEE" ? "NEWEST" : "EMPLOYEE")}
                          className="flex items-center gap-1 uppercase font-bold hover:text-indigo-600 transition cursor-pointer"
                          title="Click to sort by Staff Name"
                        >
                          <span>Custodian / Issue Info</span>
                          {sortBy === "EMPLOYEE" ? (
                            <ArrowUp className="h-3.5 w-3.5 text-indigo-600" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                          )}
                        </button>
                      </th>
                      <th className="py-3.5 px-4">Warehouse & Rack</th>
                      <th className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (sortBy === "DUE_ASC") {
                              setSortBy("DUE_DESC");
                            } else {
                              setSortBy("DUE_ASC");
                            }
                          }}
                          className="flex items-center gap-1 uppercase font-bold hover:text-indigo-600 transition cursor-pointer"
                          title="Click to toggle Due Date order (Earliest / Latest)"
                        >
                          <span>Due Date & Timeline</span>
                          {sortBy === "DUE_ASC" ? (
                            <ArrowUp className="h-3.5 w-3.5 text-indigo-600" />
                          ) : sortBy === "DUE_DESC" ? (
                            <ArrowDown className="h-3.5 w-3.5 text-indigo-600" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                          )}
                        </button>
                      </th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedItems.map((item) => {
                      const dateObj = item.returnDueDate ? new Date(item.returnDueDate) : null;
                      const formattedDueDate = dateObj
                        ? dateObj.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "No deadline";

                      return (
                        <tr
                          key={`${item.issueId}-${item.itemIndex}`}
                          className={`transition hover:bg-slate-50/90 ${
                            item.isOverdue ? "bg-red-50/20" : item.isDueToday ? "bg-amber-50/20" : ""
                          }`}
                        >
                          {/* 1. Asset / Product */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-start gap-2.5">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold ${
                                  item.isReturned
                                    ? "bg-emerald-100 text-emerald-700"
                                    : item.isOverdue
                                    ? "bg-red-100 text-red-700"
                                    : item.isDueSoon || item.isDueToday
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-indigo-100 text-indigo-700"
                                }`}
                              >
                                <Tag className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-xs sm:text-sm">
                                  {item.productName}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    SKU: {item.sku}
                                  </span>
                                  {item.serialNumber && (
                                    <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                      SN: {item.serialNumber}
                                    </span>
                                  )}
                                  <span className="text-[11px] font-bold text-slate-700">
                                    Qty: {item.quantity}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Custodian / Issue */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="font-bold text-slate-800">{item.employeeName}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                {item.employeeDepartment && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 font-medium">
                                    {item.employeeDepartment}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSelectedBillIssue(item.rawIssue)}
                                  className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                                  title="View Issue Voucher"
                                >
                                  #{item.issueNumber}
                                </button>
                                {item.siteName && (
                                  <span className="text-slate-400 truncate max-w-[140px]">
                                    • {item.siteName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 3. Warehouse & Rack */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{item.warehouseName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                <Box className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>Rack: {item.rackName}</span>
                              </div>
                            </div>
                          </td>

                          {/* 4. Due Date & Timeline */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-1.5">
                              {item.isReturned ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-200">
                                    <CheckCircle2 className="h-3 w-3" /> Returned
                                  </span>
                                  {item.returnedAt && (
                                    <p className="text-[10px] text-slate-500">
                                      on {new Date(item.returnedAt).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </p>
                                  )}
                                  {item.returnCondition && (
                                    <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                                      Condition: {item.returnCondition}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="font-bold text-slate-800">{formattedDueDate}</span>
                                  </div>

                                  {/* Countdown Badge */}
                                  <div>
                                    {item.isOverdue ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-red-600 text-white px-2 py-0.5 text-[10px] font-extrabold shadow-2xs">
                                        <AlertOctagon className="h-3 w-3" /> Overdue ({Math.abs(item.daysRemaining)}d late)
                                      </span>
                                    ) : item.isDueToday ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-extrabold shadow-2xs animate-pulse">
                                        <Clock className="h-3 w-3" /> Due Today!
                                      </span>
                                    ) : item.isDueSoon ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold border border-amber-200">
                                        <Clock className="h-3 w-3" /> Due in {item.daysRemaining} days
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-bold border border-blue-200/60">
                                        <Clock className="h-3 w-3" /> {item.daysRemaining} days left
                                      </span>
                                    )}
                                  </div>

                                  {/* Renewal Pill */}
                                  {item.renewalCount > 0 && (
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => setHistoryTarget(item)}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded px-1.5 py-0.5 transition"
                                        title="Click to view full renewal history"
                                      >
                                        <RefreshCw className="h-2.5 w-2.5" /> Renewed {item.renewalCount}x
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 5. Action Buttons */}
                          <td className="py-3.5 px-4 align-middle text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {!item.isReturned ? (
                                <>
                                  {/* Renew Button */}
                                  <button
                                    type="button"
                                    onClick={() => setRenewTarget(item)}
                                    className="flex items-center gap-1 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white px-3 py-1.5 text-xs font-bold transition border border-indigo-200 shadow-2xs active:scale-95"
                                    title="Extend loan deadline"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    <span>Renew</span>
                                  </button>

                                  {/* Return Button */}
                                  <button
                                    type="button"
                                    onClick={() => setReturnTarget(item)}
                                    className="flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs shadow-emerald-600/20 active:scale-95"
                                    title="Return item and restore to warehouse stock"
                                  >
                                    <CornerDownLeft className="h-3.5 w-3.5" />
                                    <span>Return</span>
                                  </button>
                                </>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 text-slate-500 px-2.5 py-1 text-xs font-bold">
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  Completed
                                </span>
                              )}

                              {/* View Voucher Button */}
                              <button
                                type="button"
                                onClick={() => setSelectedBillIssue(item.rawIssue)}
                                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 p-1.5 text-xs font-bold transition shadow-2xs"
                                title="View Custody Voucher"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                              </button>

                              {/* History Button (if has renewals) */}
                              {item.renewalCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setHistoryTarget(item)}
                                  className="flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 p-1.5 text-xs font-bold transition shadow-2xs"
                                  title="View Renewal Log"
                                >
                                  <History className="h-3.5 w-3.5 text-indigo-600" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalItems={filteredItems.length}
                pageSize={pageSize}
                onPageChange={(page) => setCurrentPage(page)}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </>
          )}
        </div>

        {/* ─── MODALS ─── */}

        {/* 1. Return Asset Modal */}
        {returnTarget && (
          <ReturnAssetModal
            item={returnTarget}
            warehouses={warehouses}
            racks={racks}
            onClose={() => setReturnTarget(null)}
            onSuccess={(updatedData) => handleReturnSuccess(returnTarget, updatedData)}
          />
        )}

        {/* 2. Renew Asset Modal */}
        {renewTarget && (
          <RenewAssetModal
            item={renewTarget}
            onClose={() => setRenewTarget(null)}
            onSuccess={(newDueDateStr) => handleRenewSuccess(renewTarget, newDueDateStr)}
          />
        )}

        {/* 3. Renewal History Modal */}
        {historyTarget && (
          <RenewalHistoryModal
            item={historyTarget}
            onClose={() => setHistoryTarget(null)}
          />
        )}

        {/* 4. Issue Bill Modal (Voucher preview) */}
        {selectedBillIssue && (
          <IssueBillModal
            issue={selectedBillIssue}
            onClose={() => setSelectedBillIssue(null)}
          />
        )}
      </div>
    </ProtectedPage>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENT: Return Asset Modal
// ─────────────────────────────────────────────────────────────
type ReturnModalProps = {
  item: ReturnableItemRow;
  warehouses: WarehouseOption[];
  racks: RackOption[];
  onClose: () => void;
  onSuccess: (updatedData?: any) => void;
};

function ReturnAssetModal({ item, warehouses, racks, onClose, onSuccess }: ReturnModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Return destination states
  const [destWarehouseId, setDestWarehouseId] = useState(item.warehouseId || (warehouses[0]?._id ?? ""));
  const [destRackId, setDestRackId] = useState(item.rackId || "");
  const [condition, setCondition] = useState<"GOOD" | "NEEDS_SERVICE" | "DAMAGED">("GOOD");
  const [remarks, setRemarks] = useState("");

  // Filter racks based on destWarehouseId
  const availableRacks = useMemo(() => {
    if (!destWarehouseId) return [];
    return racks.filter((r) => {
      if (typeof r.warehouseId === "object" && r.warehouseId !== null) {
        return r.warehouseId._id === destWarehouseId;
      }
      return r.warehouseId === destWarehouseId;
    });
  }, [racks, destWarehouseId]);

  // Keep rack in sync if current selected rack does not belong to destination warehouse
  useEffect(() => {
    if (availableRacks.length > 0) {
      const exists = availableRacks.some((r) => r._id === destRackId);
      if (!exists) {
        setDestRackId(availableRacks[0]._id);
      }
    } else {
      setDestRackId("");
    }
  }, [availableRacks, destRackId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destWarehouseId || !destRackId) {
      setError("Please select both a destination warehouse and rack to restore stock.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/employee-issues/${item.issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RETURN",
          itemIndex: item.itemIndex,
          returnWarehouseId: destWarehouseId,
          returnRackId: destRackId,
          returnCondition: condition,
          serviceNotes: remarks.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to process return");
      }

      onSuccess(data);
    } catch (err: any) {
      console.error("Return error:", err);
      setError(err.message || "Failed to return asset. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedWhName = warehouses.find((w) => w._id === destWarehouseId)?.name || item.warehouseName;
  const selectedRkName = availableRacks.find((r) => r._id === destRackId)?.name || item.rackName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-xs">
              <CornerDownLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Return Asset to Stock</h2>
              <p className="text-xs text-slate-500">
                Check in loan custody & replenish warehouse inventory
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Product & Custodian Info Card */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">{item.productName}</span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
                Qty: {item.quantity}
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-500 flex-wrap">
              <span>SKU: {item.sku}</span>
              {item.serialNumber && <span>SN: {item.serialNumber}</span>}
              <span>Voucher: #{item.issueNumber}</span>
            </div>
            <div className="border-t border-slate-200/60 pt-2 flex items-center justify-between text-slate-600">
              <span>Custodian: <b className="text-slate-800">{item.employeeName}</b></span>
              {item.employeeDepartment && (
                <span className="text-slate-500">Dept: {item.employeeDepartment}</span>
              )}
            </div>
          </div>

          {/* Destination Warehouse & Rack */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Restore To Warehouse & Rack
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Destination Warehouse *
                </label>
                <select
                  value={destWarehouseId}
                  onChange={(e) => setDestWarehouseId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {warehouses.map((wh) => (
                    <option key={wh._id} value={wh._id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Destination Rack *
                </label>
                <select
                  value={destRackId}
                  onChange={(e) => setDestRackId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {availableRacks.length === 0 ? (
                    <option value="">No racks in this warehouse</option>
                  ) : (
                    availableRacks.map((rk) => (
                      <option key={rk._id} value={rk._id}>
                        {rk.name} ({rk.code})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Physical Condition Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Physical Condition Check
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setCondition("GOOD")}
                className={`p-3 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${
                  condition === "GOOD"
                    ? "bg-emerald-50/90 border-2 border-emerald-500 shadow-sm ring-4 ring-emerald-500/20 scale-[1.02]"
                    : "bg-emerald-50/35 border border-emerald-200/80 hover:bg-emerald-50/70 hover:border-emerald-300"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full mx-auto mb-2 flex items-center justify-center transition-all ${
                    condition === "GOOD"
                      ? "bg-emerald-500 text-white shadow-xs"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  <Check className="h-5 w-5 stroke-[2.5]" />
                </div>
                <span className="text-xs font-bold text-emerald-950 block">Good Condition</span>
                <span className="text-[11px] text-emerald-700/80 font-medium block mt-0.5">Ready to reissue</span>
              </button>

              <button
                type="button"
                onClick={() => setCondition("NEEDS_SERVICE")}
                className={`p-3 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${
                  condition === "NEEDS_SERVICE"
                    ? "bg-amber-50/90 border-2 border-amber-500 shadow-sm ring-4 ring-amber-500/20 scale-[1.02]"
                    : "bg-amber-50/35 border border-amber-200/80 hover:bg-amber-50/70 hover:border-amber-300"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full mx-auto mb-2 flex items-center justify-center transition-all ${
                    condition === "NEEDS_SERVICE"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <Wrench className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-amber-950 block">Needs Service</span>
                <span className="text-[11px] text-amber-800/80 font-medium block mt-0.5">Requires inspection</span>
              </button>

              <button
                type="button"
                onClick={() => setCondition("DAMAGED")}
                className={`p-3 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${
                  condition === "DAMAGED"
                    ? "bg-rose-50/90 border-2 border-rose-500 shadow-sm ring-4 ring-rose-500/20 scale-[1.02]"
                    : "bg-rose-50/35 border border-rose-200/80 hover:bg-rose-50/70 hover:border-rose-300"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full mx-auto mb-2 flex items-center justify-center transition-all ${
                    condition === "DAMAGED"
                      ? "bg-rose-500 text-white shadow-xs"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-rose-950 block">Damaged</span>
                <span className="text-[11px] text-rose-800/80 font-medium block mt-0.5">Field damage</span>
              </button>
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Return Remarks / Handover Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Accessories returned, verified working, signed by employee..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Inventory Confirmation Preview */}
          <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50/70 p-3 text-xs text-emerald-800 border border-emerald-200/60">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <p className="text-[11px] leading-relaxed">
              Submitting will restore <b>{item.quantity} unit(s)</b> back into stock at{" "}
              <b>{selectedWhName}</b> (Rack: <b>{selectedRkName}</b>) and record an INWARD stock movement.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !destRackId}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs shadow-emerald-600/20 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing Return...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Confirm Return & Restore Stock</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENT: Renew Asset Modal
// ─────────────────────────────────────────────────────────────
type RenewModalProps = {
  item: ReturnableItemRow;
  onClose: () => void;
  onSuccess: (newDueDateStr: string) => void;
};

function RenewAssetModal({ item, onClose, onSuccess }: RenewModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extend days state
  const [extendDays, setExtendDays] = useState<number>(30);
  const [remarks, setRemarks] = useState("");

  // Calculate new due date preview
  const currentDue = item.returnDueDate ? new Date(item.returnDueDate) : new Date();
  const baseDate = currentDue.getTime() < Date.now() ? new Date() : currentDue;
  const calculatedNewDate = new Date(baseDate.getTime() + (extendDays || 1) * 86400000);

  const formattedCurrentDueDate = item.returnDueDate
    ? new Date(item.returnDueDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "None";

  const formattedNewDueDate = calculatedNewDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendDays || extendDays < 1) {
      setError("Please specify at least 1 extension day.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/employee-issues/${item.issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RENEW_ITEM",
          itemIndex: item.itemIndex,
          extendedDays: extendDays,
          serviceNotes: remarks.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to renew item");
      }

      onSuccess(formattedNewDueDate);
    } catch (err: any) {
      console.error("Renewal error:", err);
      setError(err.message || "Failed to extend loan. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 shadow-xs">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Renew Asset Loan Period</h2>
              <p className="text-xs text-slate-500">
                Extend return due date for custodian employee
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Product & Custodian Info Card */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">{item.productName}</span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
                Qty: {item.quantity}
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-500 flex-wrap">
              <span>SKU: {item.sku}</span>
              {item.serialNumber && <span>SN: {item.serialNumber}</span>}
              <span>Voucher: #{item.issueNumber}</span>
            </div>
            <div className="border-t border-slate-200/60 pt-2 flex items-center justify-between text-slate-600">
              <span>Custodian: <b className="text-slate-800">{item.employeeName}</b></span>
              {item.renewalCount > 0 && (
                <span className="text-indigo-600 font-bold">Already renewed {item.renewalCount}x</span>
              )}
            </div>
          </div>

          {/* Current vs New Due Date Comparison */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100">
            <div>
              <span className="text-[11px] font-semibold text-slate-500">Current Due Date:</span>
              <p className="font-bold text-slate-700 text-xs mt-0.5">{formattedCurrentDueDate}</p>
              {item.isOverdue && (
                <span className="text-[10px] font-bold text-red-600">Currently Overdue</span>
              )}
            </div>
            <div className="border-l border-indigo-100 pl-3">
              <span className="text-[11px] font-semibold text-indigo-600">New Due Date:</span>
              <p className="font-black text-indigo-800 text-sm mt-0.5">{formattedNewDueDate}</p>
              <span className="text-[10px] font-semibold text-indigo-600">+{extendDays} days extension</span>
            </div>
          </div>

          {/* Quick Extension Pills */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Select Extension Period
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "+7 Days", days: 7, desc: "1 Week" },
                { label: "+15 Days", days: 15, desc: "Half Mo." },
                { label: "+30 Days", days: 30, desc: "1 Month" },
                { label: "+60 Days", days: 60, desc: "2 Months" },
              ].map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setExtendDays(opt.days)}
                  className={`p-2 rounded-xl border text-center transition ${
                    extendDays === opt.days
                      ? "bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xs block">{opt.label}</span>
                  <span className={`text-[10px] block ${extendDays === opt.days ? "text-indigo-200" : "text-slate-400"}`}>
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom Days Input */}
            <div className="pt-1 flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Or custom days:</span>
              <input
                type="number"
                min="1"
                max="365"
                value={extendDays}
                onChange={(e) => setExtendDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <span className="text-xs text-slate-400">days</span>
            </div>
          </div>

          {/* Renewal Reason */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Extension Reason / Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Project extended on client request, approved by manager..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Past Renewal History Snippet */}
          {item.renewalHistory && item.renewalHistory.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-500">Previous Renewals:</span>
              <div className="max-h-24 overflow-y-auto space-y-1 rounded-lg bg-slate-50 p-2 text-[11px] border border-slate-100">
                {item.renewalHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-slate-600">
                    <span>
                      #{h.renewalNumber}: +{h.extendedDays} days on{" "}
                      {new Date(h.renewedAt).toLocaleDateString("en-IN")}
                    </span>
                    <span className="text-slate-400 italic truncate max-w-[150px]">
                      {h.notes || "No notes"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-xs shadow-indigo-600/20 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Extending Loan...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  <span>Confirm Extension (+{extendDays}d)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENT: Renewal History Modal
// ─────────────────────────────────────────────────────────────
type HistoryModalProps = {
  item: ReturnableItemRow;
  onClose: () => void;
};

function RenewalHistoryModal({ item, onClose }: HistoryModalProps) {
  const history = item.renewalHistory || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 shadow-xs">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Renewal History Log</h2>
              <p className="text-xs text-slate-500">
                Timeline of all loan extensions for this item
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Item Info Summary */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-1 text-xs">
            <p className="font-bold text-slate-900">{item.productName}</p>
            <div className="flex items-center gap-3 text-slate-500 text-[11px]">
              <span>SKU: {item.sku}</span>
              <span>Custodian: {item.employeeName}</span>
              <span>Issue #{item.issueNumber}</span>
            </div>
          </div>

          {/* Timeline */}
          {history.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-400">
              No renewal records logged for this item yet.
            </p>
          ) : (
            <div className="relative pl-6 space-y-4 border-l-2 border-indigo-200 ml-2">
              {history.map((rec, i) => (
                <div key={i} className="relative">
                  {/* Dot */}
                  <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-600 shadow-xs" />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-700">
                        Renewal #{rec.renewalNumber} (+{rec.extendedDays} Days)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(rec.renewedAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      New Due Date:{" "}
                      <b className="text-slate-800">
                        {new Date(rec.newDueDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </b>
                    </p>
                    {rec.notes && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                        Reason: {rec.notes}
                      </p>
                    )}
                    {rec.performedBy && (
                      <p className="text-[10px] text-slate-400">
                        Authorized by: {rec.performedBy}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 transition"
            >
              Close Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
