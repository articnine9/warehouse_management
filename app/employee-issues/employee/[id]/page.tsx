"use client";

import { useEffect, useState, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  ArrowLeft,
  Calendar,
  Building2,
  Phone,
  Mail,
  PackageCheck,
  RotateCcw,
  Wrench,
  Clock,
  Search,
  X,
  Printer,
  ExternalLink,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileSpreadsheet,
  ShieldCheck,
  Tag,
  Warehouse,
} from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import ServiceCycleBadge from "@/app/components/ServiceCycleBadge";
import IssueBillModal, { IssueBillData } from "@/app/components/IssueBillModal";

interface EmployeeHistoryData {
  employee: {
    id: string;
    employeeCode: string;
    name: string;
    department: string;
    designation: string;
    email?: string;
    phone?: string;
    warehouse?: { name: string; code: string; address?: string };
    status?: string;
    joinedDate?: string;
    createdAt?: string;
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
    unitPrice?: number;
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
    siteName?: string;
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

type UnifiedAssetItem = {
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
  issuedAt: string;
  returnedAt?: string;
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
  isReturned: boolean;
};

const employeeDetailCache = new Map<string, EmployeeHistoryData>();

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const cached = employeeDetailCache.get(id);
  const [data, setData] = useState<EmployeeHistoryData | null>(() => cached || null);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<
    "CUSTODY" | "ALL_ITEMS" | "RETURNED" | "SLIPS" | "SERVICES"
  >("CUSTODY");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Bill Modal
  const [selectedBill, setSelectedBill] = useState<IssueBillData | null>(null);

  useEffect(() => {
    async function fetchEmployeeData() {
      if (!id) return;
      try {
        if (!employeeDetailCache.has(id)) {
          setLoading(true);
        }
        setError(null);
        const res = await fetch(`/api/history/employee/${encodeURIComponent(id)}`);
        const result = await res.json();
        if (result.success) {
          employeeDetailCache.set(id, result.data);
          setData(result.data);
          // Set default tab based on assets if first load
          if (!cached) {
            if (result.data.activeAssets?.length > 0) {
              setActiveTab("CUSTODY");
            } else if (result.data.returnedAssets?.length > 0) {
              setActiveTab("RETURNED");
            } else {
              setActiveTab("SLIPS");
            }
          }
        } else {
          setError(result.message || "Employee not found");
        }
      } catch (err) {
        console.error("Failed to load employee details:", err);
        setError("Network error loading employee details");
      } finally {
        setLoading(false);
      }
    }

    void fetchEmployeeData();
  }, [id]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, typeFilter, startDate, endDate, activeTab]);

  // Helper: Format Join Date and Tenure
  const tenureText = useMemo(() => {
    if (!data?.employee.joinedDate && !data?.employee.createdAt) return null;
    const joinDate = new Date(data.employee.joinedDate || data.employee.createdAt || "");
    if (isNaN(joinDate.getTime())) return null;

    const now = new Date();
    const diffTime = Math.abs(now.getTime() - joinDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);

    let duration = "";
    if (years > 0) {
      duration = `${years} yr${years > 1 ? "s" : ""}${months > 0 ? ` ${months} mo${months > 1 ? "s" : ""}` : ""}`;
    } else if (months > 0) {
      duration = `${months} month${months > 1 ? "s" : ""}`;
    } else {
      duration = `${diffDays} day${diffDays > 1 ? "s" : ""}`;
    }

    const formattedDate = joinDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    return { formattedDate, duration };
  }, [data]);

  // Filtered Active Custody Items
  const filteredActiveAssets = useMemo(() => {
    if (!data) return [];
    return data.activeAssets.filter((item) => {
      if (typeFilter === "REUSABLE" && item.productType !== "REUSABLE" && !item.returnDueDate) {
        return false;
      }
      if (typeFilter === "STANDARD" && (item.productType === "REUSABLE" || item.returnDueDate)) {
        return false;
      }
      if (startDate) {
        if (new Date(item.issuedAt) < new Date(startDate)) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(item.issuedAt) > end) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          item.productName.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.serialNumber?.toLowerCase().includes(q) ||
          item.issueNumber.toLowerCase().includes(q) ||
          item.warehouseName.toLowerCase().includes(q) ||
          item.rackName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [data, typeFilter, startDate, endDate, searchQuery]);

  // Filtered Returned Items
  const filteredReturnedAssets = useMemo(() => {
    if (!data) return [];
    return data.returnedAssets.filter((item) => {
      if (startDate) {
        const dateToCheck = item.returnedAt || item.issuedAt;
        if (new Date(dateToCheck) < new Date(startDate)) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        const dateToCheck = item.returnedAt || item.issuedAt;
        if (new Date(dateToCheck) > end) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          item.productName.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.serialNumber?.toLowerCase().includes(q) ||
          item.issueNumber.toLowerCase().includes(q) ||
          item.warehouseName.toLowerCase().includes(q) ||
          item.rackName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [data, startDate, endDate, searchQuery]);

  // Combined All Items History (Ever Taken: Active + Returned)
  const combinedAllItems = useMemo<UnifiedAssetItem[]>(() => {
    if (!data) return [];
    const active: UnifiedAssetItem[] = data.activeAssets.map((a) => ({
      ...a,
      isReturned: false,
    }));
    const returned: UnifiedAssetItem[] = data.returnedAssets.map((r) => ({
      ...r,
      isReturned: true,
      holdingStatus: "RETURNED",
      unitPrice: r.unitPrice || 0,
    }));
    const all: UnifiedAssetItem[] = [...active, ...returned];
    all.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

    return all.filter((item) => {
      if (typeFilter === "REUSABLE" && item.productType !== "REUSABLE" && !item.returnDueDate) {
        return false;
      }
      if (typeFilter === "STANDARD" && (item.productType === "REUSABLE" || item.returnDueDate)) {
        return false;
      }
      if (startDate) {
        if (new Date(item.issuedAt) < new Date(startDate)) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(item.issuedAt) > end) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          item.productName.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.serialNumber?.toLowerCase().includes(q) ||
          item.issueNumber.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [data, typeFilter, startDate, endDate, searchQuery]);

  // Filtered Issue Slips
  const filteredSlips = useMemo(() => {
    if (!data) return [];
    return data.issueSlips.filter((slip) => {
      if (startDate) {
        if (new Date(slip.date) < new Date(startDate)) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(slip.date) > end) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          slip.issueNumber.toLowerCase().includes(q) ||
          slip.reason.toLowerCase().includes(q) ||
          slip.notes?.toLowerCase().includes(q) ||
          slip.issuedByName?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [data, startDate, endDate, searchQuery]);

  // Filtered Services
  const filteredServices = useMemo(() => {
    if (!data) return [];
    return data.serviceHistory.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          s.productName.toLowerCase().includes(q) ||
          s.sku.toLowerCase().includes(q) ||
          s.serialNumber?.toLowerCase().includes(q) ||
          s.issueNumber.toLowerCase().includes(q) ||
          s.notes?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, searchQuery]);

  // Paginated View
  const paginatedItems = useMemo(() => {
    let list: unknown[] = [];
    if (activeTab === "CUSTODY") list = filteredActiveAssets;
    else if (activeTab === "ALL_ITEMS") list = combinedAllItems;
    else if (activeTab === "RETURNED") list = filteredReturnedAssets;
    else if (activeTab === "SLIPS") list = filteredSlips;
    else if (activeTab === "SERVICES") list = filteredServices;

    const start = (page - 1) * pageSize;
    return {
      total: list.length,
      rows: list.slice(start, start + pageSize),
    };
  }, [
    activeTab,
    filteredActiveAssets,
    combinedAllItems,
    filteredReturnedAssets,
    filteredSlips,
    filteredServices,
    page,
    pageSize,
  ]);

  function handleOpenBill(slipId: string) {
    if (!data) return;
    const slip = data.issueSlips.find((s) => s.id === slipId);
    if (!slip) return;

    // Gather items belonging to this issue
    const itemsFromActive = data.activeAssets
      .filter((a) => a.issueId === slipId)
      .map((a) => ({
        productId: a.productId,
        productName: a.productName,
        sku: a.sku,
        serialNumber: a.serialNumber,
        warehouseName: a.warehouseName,
        rackName: a.rackName,
        quantity: a.quantity,
        unitPrice: a.unitPrice,
        totalValue: a.totalValue,
        productType: (a.productType as "REUSABLE" | "NON_REUSABLE") || "NON_REUSABLE",
        returnDueDays: a.returnDueDays,
        returnDueDate: a.returnDueDate ? new Date(a.returnDueDate) : undefined,
        serviceIntervalMonths: a.serviceIntervalMonths,
        holdingStatus: a.holdingStatus as "ACTIVE" | "INACTIVE" | "UNDER_SERVICE" | "RETURNED" | "DAMAGED",
      }));

    const itemsFromReturned = data.returnedAssets
      .filter((r) => r.issueId === slipId)
      .map((r) => ({
        productId: r.productId,
        productName: r.productName,
        sku: r.sku,
        serialNumber: r.serialNumber,
        warehouseName: r.warehouseName,
        rackName: r.rackName,
        quantity: r.quantity,
        unitPrice: r.unitPrice || 0,
        totalValue: r.totalValue,
        holdingStatus: "RETURNED" as const,
      }));

    setSelectedBill({
      _id: slip.id,
      issueNumber: slip.issueNumber,
      createdAt: slip.date,
      employeeName: data.employee.name,
      employeeCode: data.employee.employeeCode,
      employeeDepartment: data.employee.department,
      employeePhone: data.employee.phone,
      employeeEmail: data.employee.email,
      employeeDesignation: data.employee.designation,
      reason: slip.reason,
      siteName: slip.siteName,
      notes: slip.notes,
      issuedByName: slip.issuedByName,
      items: [...itemsFromActive, ...itemsFromReturned],
      totalQuantity: slip.totalQuantity,
      totalValue: slip.totalValue,
    });
  }

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50/80 p-3 sm:p-5 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Top Breadcrumb & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/employee-issues")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Asset Movement & History
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-500">Employee Asset Movement & History</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              title="Print Employee Custody Record"
            >
              <Printer className="h-4 w-4 text-slate-500" /> Print Custody Statement
            </button>
            <button
              type="button"
              onClick={() => router.push(`/employee-issues?empId=${encodeURIComponent(id)}`)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition active:scale-95"
            >
              <PackageCheck className="h-4 w-4" /> Issue New Product
            </button>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="mt-3 text-sm font-semibold text-slate-600">
              Loading employee lifecycle and asset custody history...
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-xs">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
            <h3 className="mt-2 text-base font-bold text-red-800">Error Loading Employee</h3>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/employee-issues")}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition"
            >
              Return to Issues
            </button>
          </div>
        )}

        {data && (
          <>
            {/* ─── HERO EMPLOYEE PROFILE HEADER ─── */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-blue-50/20 to-indigo-50/30 p-5 md:p-7 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-2xl font-black text-white shadow-md">
                    {data.employee.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl md:text-2xl font-extrabold text-slate-800">
                        {data.employee.name}
                      </h1>
                      <span className="rounded-lg bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                        {data.employee.employeeCode}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          data.employee.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {data.employee.status || "ACTIVE"}
                      </span>
                    </div>

                    {/* Employee Tenure & Joined Date Badge */}
                    <div className="mt-2 flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs text-slate-600">
                      {tenureText && (
                        <div className="flex items-center gap-1.5 font-semibold text-blue-900 bg-blue-50/80 px-2.5 py-1 rounded-md border border-blue-200/60">
                          <Calendar className="h-3.5 w-3.5 text-blue-600" />
                          <span>Joined: <b>{tenureText.formattedDate}</b></span>
                          <span className="text-blue-500 font-normal">({tenureText.duration} tenure)</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>Dept: <b className="text-slate-800">{data.employee.department || "General"}</b></span>
                      </div>

                      {data.employee.designation && (
                        <div className="flex items-center gap-1">
                          <Tag className="h-3.5 w-3.5 text-slate-400" />
                          <span>Designation: <b className="text-slate-800">{data.employee.designation}</b></span>
                        </div>
                      )}

                      {data.employee.warehouse && (
                        <div className="flex items-center gap-1">
                          <Warehouse className="h-3.5 w-3.5 text-slate-400" />
                          <span>Base: <b className="text-slate-800">{data.employee.warehouse.name}</b></span>
                        </div>
                      )}
                    </div>

                    {/* Contact details */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      {data.employee.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{data.employee.phone}</span>
                        </div>
                      )}
                      {data.employee.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span>{data.employee.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── SUMMARY KPI METRICS STRIP ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Total Taken Ever
                </span>
                <p className="text-xl font-black text-slate-800 mt-0.5">
                  {data.summary.activeUnitsCount + data.summary.returnedUnitsCount}{" "}
                  <span className="text-xs font-semibold text-slate-500">units</span>
                </p>
                <span className="text-[11px] text-slate-400">Since joined date</span>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                  Active In Custody
                </span>
                <p className="text-xl font-black text-emerald-700 mt-0.5">
                  {data.summary.activeUnitsCount}{" "}
                  <span className="text-xs font-semibold text-emerald-600">units</span>
                </p>
                <span className="text-[11px] text-emerald-600 font-medium">Currently holding</span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Returned to Stock
                </span>
                <p className="text-xl font-black text-slate-700 mt-0.5">
                  {data.summary.returnedUnitsCount}{" "}
                  <span className="text-xs font-semibold text-slate-500">units</span>
                </p>
                <span className="text-[11px] text-slate-400">Back in warehouse</span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Issue Vouchers
                </span>
                <p className="text-xl font-black text-slate-800 mt-0.5">
                  {data.summary.totalIssuesCount}{" "}
                  <span className="text-xs font-semibold text-slate-500">slips</span>
                </p>
                <span className="text-[11px] text-slate-400">Official issues signed</span>
              </div>

              <div
                className={`rounded-xl border p-3.5 shadow-2xs ${
                  data.summary.overdueCount > 0
                    ? "border-red-200 bg-red-50/50 text-red-700"
                    : "border-slate-200 bg-white text-slate-800"
                }`}
              >
                <span className="text-[10px] font-bold uppercase block opacity-70">
                  Return Overdue
                </span>
                <p className="text-xl font-black mt-0.5">
                  {data.summary.overdueCount}{" "}
                  <span className="text-xs font-semibold">items</span>
                </p>
                <span className="text-[11px] opacity-80">
                  {data.summary.overdueCount > 0 ? "Requires return/renewal" : "All returns on time"}
                </span>
              </div>
            </div>

            {/* ─── DIRECTORY CONTAINER WITH TABS & FILTERS ─── */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              {/* Tabs Navigation */}
              <div className="border-b border-slate-200 bg-slate-50/60 p-2 sm:px-4 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("CUSTODY")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "CUSTODY"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <PackageCheck className="h-3.5 w-3.5 text-blue-600" />
                  Currently In Custody
                  <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.2 text-[10px] font-extrabold text-blue-800">
                    {data.activeAssets.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("ALL_ITEMS")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "ALL_ITEMS"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 text-indigo-600" />
                  All Issued Items (Lifetime)
                  <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.2 text-[10px] font-extrabold text-slate-700">
                    {data.activeAssets.length + data.returnedAssets.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("RETURNED")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "RETURNED"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                  Returned Items
                  <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-extrabold text-emerald-800">
                    {data.returnedAssets.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("SLIPS")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "SLIPS"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Receipt className="h-3.5 w-3.5 text-slate-600" />
                  Issue Vouchers / Slips
                  <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.2 text-[10px] font-extrabold text-slate-700">
                    {data.issueSlips.length}
                  </span>
                </button>
              </div>

              {/* Filter Controls Bar */}
              <div className="border-b border-slate-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search product, SKU, serial, slip..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 pl-8 pr-7 py-1.5 text-xs outline-none focus:border-blue-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Reusable / Standard Filter */}
                  {(activeTab === "CUSTODY" || activeTab === "ALL_ITEMS") && (
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Product Types</option>
                      <option value="REUSABLE">Returnable Only</option>
                      <option value="STANDARD">Standard Items</option>
                    </select>
                  )}

                  {/* Date range filters */}
                  <div className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                      title="Filter from date"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                      title="Filter to date"
                    />
                  </div>

                  {(searchQuery || typeFilter !== "ALL" || startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setTypeFilter("ALL");
                        setStartDate("");
                        setEndDate("");
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                <div className="text-xs font-semibold text-slate-500">
                  Showing {paginatedItems.rows.length} of {paginatedItems.total} records
                </div>
              </div>

              {/* ─── TAB 1: CURRENTLY IN CUSTODY ─── */}
              {activeTab === "CUSTODY" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Product Name & SKU</th>
                        <th className="px-5 py-3">Issue Details</th>
                        <th className="px-5 py-3">Location & Serial</th>
                        <th className="px-5 py-3">Qty & Value</th>
                        <th className="px-5 py-3">Return Due / Overdue</th>
                        <th className="px-5 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredActiveAssets.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            No active items currently held in custody.
                          </td>
                        </tr>
                      ) : (
                        (paginatedItems.rows as typeof filteredActiveAssets).map((item, idx) => {
                          const isReusable = item.productType === "REUSABLE" || Boolean(item.returnDueDate);

                          return (
                            <tr key={`${item.issueId}-${item.itemIndex || idx}`} className="hover:bg-slate-50/70 transition">
                              <td className="px-5 py-3.5">
                                <Link
                                  href={`/product-history/${item.productId}`}
                                  className="font-bold text-slate-800 hover:text-blue-600 hover:underline transition flex items-center gap-1 group"
                                  title="View complete product lifecycle & inward history"
                                >
                                  <span>{item.productName}</span>
                                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-blue-600 transition" />
                                </Link>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                                  <span>SKU: {item.sku}</span>
                                  {isReusable && (
                                    <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700">
                                      Returnable
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-5 py-3.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenBill(item.issueId)}
                                  className="font-semibold text-blue-600 hover:underline text-left"
                                  title="View Issue Voucher"
                                >
                                  #{item.issueNumber}
                                </button>
                                <p className="text-[11px] text-slate-400">
                                  {new Date(item.issuedAt).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                              </td>

                              <td className="px-5 py-3.5">
                                <p className="font-medium text-slate-700">
                                  {item.warehouseName} • {item.rackName}
                                </p>
                                {item.serialNumber && (
                                  <span className="text-[10px] font-mono text-slate-500 block">
                                    SN: {item.serialNumber}
                                  </span>
                                )}
                              </td>

                              <td className="px-5 py-3.5">
                                <p className="font-bold text-slate-800">{item.quantity} units</p>
                                <span className="text-[11px] text-slate-400">
                                  ₹{(item.totalValue || item.unitPrice * item.quantity).toLocaleString("en-IN")}
                                </span>
                              </td>

                              <td className="px-5 py-3.5">
                                {isReusable && item.returnDueDate ? (
                                  <div>
                                    <p className="font-bold text-xs text-slate-800">
                                      {new Date(item.returnDueDate).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </p>
                                    {item.daysRemaining !== undefined && (
                                      <span
                                        className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-extrabold mt-0.5 ${
                                          item.isOverdue
                                            ? "bg-red-100 text-red-700"
                                            : item.daysRemaining <= 7
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-emerald-50 text-emerald-700"
                                        }`}
                                      >
                                        {item.isOverdue
                                          ? `Overdue by ${Math.abs(item.daysRemaining)}d`
                                          : item.daysRemaining === 0
                                          ? "Due Today"
                                          : `${item.daysRemaining}d remaining`}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">Standard / Permanent</span>
                                )}
                              </td>

                              <td className="px-5 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenBill(item.issueId)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 shadow-2xs transition"
                                    title="View Issue Voucher"
                                  >
                                    <Receipt className="h-4 w-4" />
                                  </button>
                                  <Link
                                    href={`/product-history/${item.productId}`}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 shadow-2xs transition"
                                    title="View Product Lifecycle Page"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ─── TAB 2: ALL ITEMS (LIFETIME TAKEN & RETURNED) ─── */}
              {activeTab === "ALL_ITEMS" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Product Name & SKU</th>
                        <th className="px-5 py-3">Current Status</th>
                        <th className="px-5 py-3">Issue Date & Slip</th>
                        <th className="px-5 py-3">Qty & Value</th>
                        <th className="px-5 py-3">Return Due / Returned At</th>
                        <th className="px-5 py-3">Warehouse & Rack</th>
                        <th className="px-5 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {combinedAllItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No product records found in this employee&apos;s history.
                          </td>
                        </tr>
                      ) : (
                        (paginatedItems.rows as typeof combinedAllItems).map((item, idx) => {
                          const isReturned = item.isReturned;
                          return (
                            <tr key={`all-${item.issueId}-${idx}`} className="hover:bg-slate-50/70 transition">
                              <td className="px-5 py-3.5">
                                <Link
                                  href={`/product-history/${item.productId}`}
                                  className="font-bold text-slate-800 hover:text-blue-600 hover:underline transition flex items-center gap-1"
                                >
                                  {item.productName}
                                </Link>
                                <span className="text-[11px] text-slate-400 block">
                                  SKU: {item.sku} {item.serialNumber && `• SN: ${item.serialNumber}`}
                                </span>
                              </td>

                              <td className="px-5 py-3.5">
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                                    isReturned
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : item.holdingStatus === "ACTIVE"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                                >
                                  {isReturned ? "RETURNED TO STOCK" : item.holdingStatus || "ACTIVE (IN CUSTODY)"}
                                </span>
                              </td>

                              <td className="px-5 py-3.5">
                                <p className="font-bold text-slate-800">
                                  {new Date(item.issuedAt).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleOpenBill(item.issueId)}
                                  className="text-[11px] text-blue-600 hover:underline"
                                >
                                  Slip #{item.issueNumber}
                                </button>
                              </td>

                              <td className="px-5 py-3.5">
                                <span className="font-bold text-slate-800">{item.quantity} units</span>
                                <span className="text-[11px] text-slate-400 block">
                                  ₹{(item.totalValue || 0).toLocaleString("en-IN")}
                                </span>
                              </td>

                              <td className="px-5 py-3.5">
                                {isReturned ? (
                                  <div>
                                    <span className="font-semibold text-emerald-700">Returned</span>
                                    <span className="text-[11px] text-slate-400 block">
                                      {item.returnedAt
                                        ? new Date(item.returnedAt).toLocaleDateString("en-IN", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                          })
                                        : "Yes"}
                                    </span>
                                  </div>
                                ) : item.returnDueDate ? (
                                  <div>
                                    <span className="font-semibold text-slate-800">
                                      Due:{" "}
                                      {new Date(item.returnDueDate).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">Standard</span>
                                )}
                              </td>

                              <td className="px-5 py-3.5 text-slate-600">
                                {item.warehouseName} • {item.rackName}
                              </td>

                              <td className="px-5 py-3.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenBill(item.issueId)}
                                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                                >
                                  View Bill
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ─── TAB 3: RETURNED ITEMS ─── */}
              {activeTab === "RETURNED" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Product Name & SKU</th>
                        <th className="px-5 py-3">Original Issue Date</th>
                        <th className="px-5 py-3">Returned Date</th>
                        <th className="px-5 py-3">Quantity</th>
                        <th className="px-5 py-3">Restored Warehouse</th>
                        <th className="px-5 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredReturnedAssets.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            No returned items recorded for this employee.
                          </td>
                        </tr>
                      ) : (
                        (paginatedItems.rows as typeof filteredReturnedAssets).map((item, idx) => (
                          <tr key={`ret-${item.issueId}-${idx}`} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-3.5">
                              <Link
                                href={`/product-history/${item.productId}`}
                                className="font-bold text-slate-800 hover:text-blue-600 hover:underline"
                              >
                                {item.productName}
                              </Link>
                              <span className="text-[11px] text-slate-400 block">
                                SKU: {item.sku} {item.serialNumber && `• SN: ${item.serialNumber}`}
                              </span>
                            </td>

                            <td className="px-5 py-3.5 text-slate-600">
                              {new Date(item.issuedAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                              <span className="text-[11px] text-slate-400 block">Slip #{item.issueNumber}</span>
                            </td>

                            <td className="px-5 py-3.5">
                              <span className="font-bold text-emerald-700">
                                {item.returnedAt
                                  ? new Date(item.returnedAt).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : "Returned"}
                              </span>
                            </td>

                            <td className="px-5 py-3.5 font-bold text-slate-800">{item.quantity} units</td>

                            <td className="px-5 py-3.5 text-slate-600">
                              {item.warehouseName} • {item.rackName}
                            </td>

                            <td className="px-5 py-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenBill(item.issueId)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                              >
                                View Bill
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ─── TAB 4: ISSUE VOUCHERS / SLIPS ─── */}
              {activeTab === "SLIPS" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Voucher #</th>
                        <th className="px-5 py-3">Date Issued</th>
                        <th className="px-5 py-3">Reason</th>
                        <th className="px-5 py-3">Items Count</th>
                        <th className="px-5 py-3">Total Quantity</th>
                        <th className="px-5 py-3">Total Value</th>
                        <th className="px-5 py-3">Issued By</th>
                        <th className="px-5 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSlips.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            No issue vouchers found.
                          </td>
                        </tr>
                      ) : (
                        (paginatedItems.rows as typeof filteredSlips).map((slip) => (
                          <tr key={slip.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-3.5 font-bold text-blue-600">
                              #{slip.issueNumber}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">
                              {new Date(slip.date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-5 py-3.5 font-medium text-slate-700">
                              {slip.reason.replace("_", " ")}
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-slate-700">
                              {slip.totalItems} distinct items
                            </td>
                            <td className="px-5 py-3.5 font-bold text-slate-800">
                              {slip.totalQuantity} units
                            </td>
                            <td className="px-5 py-3.5 font-bold text-slate-900">
                              ₹{slip.totalValue.toLocaleString("en-IN")}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500">
                              {slip.issuedByName || "Admin"}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenBill(slip.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 shadow-2xs transition"
                              >
                                <Receipt className="h-3.5 w-3.5" /> View Voucher
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}



              {/* Pagination */}
              {paginatedItems.total > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/40">
                  <Pagination
                    currentPage={page}
                    totalItems={paginatedItems.total}
                    pageSize={pageSize}
                    onPageChange={(p) => setPage(p)}
                    onPageSizeChange={(s) => setPageSize(s)}
                    pageSizeOptions={[10, 15, 25, 50]}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* 🧾 Official Bill Modal */}
        {selectedBill && (
          <IssueBillModal issue={selectedBill} onClose={() => setSelectedBill(null)} />
        )}
      </div>
    </ProtectedPage>
  );
}
