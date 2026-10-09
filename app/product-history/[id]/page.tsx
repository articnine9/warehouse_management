"use client";

import { useEffect, useState, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Building2,
  Package,
  RotateCcw,
  Wrench,
  Clock,
  Search,
  X,
  Printer,
  ExternalLink,
  ShieldCheck,
  Tag,
  Warehouse,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  AlertTriangle,
  Layers,
  History,
  CheckCircle2,
  Users,
  Sparkles,
  ArrowUpDown,
} from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";

interface ProductHistoryData {
  product: {
    id: string;
    name: string;
    sku: string;
    category?: string;
    price?: number;
    description?: string;
    warrantyMonths?: number;
    serviceIntervalMonths?: number;
    sellerName?: string;
    createdAt?: string;
  };
  summary: {
    totalInStock: number;
    totalUnitsActiveIssued: number;
    totalUnitsReturned: number;
    totalMovementRecords: number;
    totalHolders: number;
    activeHoldersCount: number;
  };
  inventoryLocations: Array<{
    id: string;
    warehouse: { _id: string; name: string; code: string; address?: string };
    rack: { _id: string; name: string; code: string };
    quantity: number;
    status: string;
    updatedAt: string;
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
  initialStockArrival?: {
    date: string;
    quantity: number;
    warehouseName: string;
    rackName: string;
    unitPrice: number;
    totalValue: number;
    supplier: string;
    referenceNumber?: string;
    performedByName?: string;
    notes?: string;
    isOrigin?: boolean;
  };
  lifecycleEvents: Array<{
    id: string;
    date: string;
    eventType:
      | "INITIAL_STOCK"
      | "INWARD"
      | "OUTWARD"
      | "EMPLOYEE_ISSUE"
      | "EMPLOYEE_RETURN"
      | "SERVICE"
      | "INVOICE_SALE"
      | "PRODUCT_CREATED";
    isInitialStock?: boolean;
    title: string;
    subtitle?: string;
    quantity: number;
    unitPrice?: number;
    totalValue?: number;
    entityName?: string;
    location?: string;
    notes?: string;
    referenceNumber?: string;
    performedByName?: string;
    badgeColor?: string;
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
}

const productDetailCache = new Map<string, ProductHistoryData>();

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const cached = productDetailCache.get(id);
  const [data, setData] = useState<ProductHistoryData | null>(() => cached || null);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<
    "LIFECYCLE" | "HOLDERS" | "STOCK" | "MOVEMENTS" | "RETURNS"
  >("LIFECYCLE");

  // Filters & Ordering
  const [timelineOrder, setTimelineOrder] = useState<"OLDEST_FIRST" | "NEWEST_FIRST">("OLDEST_FIRST");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    async function fetchProductData() {
      if (!id) return;
      try {
        if (!productDetailCache.has(id)) {
          setLoading(true);
        }
        setError(null);
        const res = await fetch(`/api/history/product/${encodeURIComponent(id)}`);
        const result = await res.json();
        if (result.success) {
          productDetailCache.set(id, result.data);
          setData(result.data);
        } else {
          setError(result.message || "Product not found");
        }
      } catch (err) {
        console.error("Failed to fetch product history:", err);
        setError("Network error loading product history");
      } finally {
        setLoading(false);
      }
    }

    void fetchProductData();
  }, [id]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, startDate, endDate, activeTab, timelineOrder]);

  // First Inward / Arrival Date
  const arrivalInfo = useMemo(() => {
    if (!data) return null;

    if (data.initialStockArrival) {
      const formatted = new Date(data.initialStockArrival.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      return {
        formatted,
        rawDate: data.initialStockArrival.date,
        supplier: data.initialStockArrival.supplier,
        quantity: data.initialStockArrival.quantity,
        location: `${data.initialStockArrival.warehouseName} • ${data.initialStockArrival.rackName}`,
        warehouseName: data.initialStockArrival.warehouseName,
        rackName: data.initialStockArrival.rackName,
        unitPrice: data.initialStockArrival.unitPrice,
        totalValue: data.initialStockArrival.totalValue,
        performedByName: data.initialStockArrival.performedByName,
        referenceNumber: data.initialStockArrival.referenceNumber,
        notes: data.initialStockArrival.notes,
      };
    }

    const inwardMovements = data.movements.filter((m) => m.movementType === "INWARD");
    const earliest = inwardMovements.length > 0
      ? inwardMovements[inwardMovements.length - 1]
      : null;

    const arrivalDate = earliest?.createdAt || data.product.createdAt;
    if (!arrivalDate) return null;

    const formatted = new Date(arrivalDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    return {
      formatted,
      rawDate: arrivalDate,
      supplier: earliest?.entityName || data.product.sellerName || "Supplier Inward",
      quantity: earliest?.quantity,
      location: earliest?.warehouseName ? `${earliest.warehouseName} • ${earliest.rackName || ""}` : null,
      warehouseName: earliest?.warehouseName,
      rackName: earliest?.rackName,
      unitPrice: earliest?.unitPrice,
      totalValue: earliest?.totalValue,
      performedByName: earliest?.performedByName,
      referenceNumber: earliest?.referenceNumber,
      notes: earliest?.notes,
    };
  }, [data]);

  // Filtered Lifecycle Events
  const filteredLifecycle = useMemo(() => {
    if (!data) return [];
    let list = data.lifecycleEvents.filter((ev) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "INWARD" && ev.eventType !== "INITIAL_STOCK" && ev.eventType !== "INWARD") return false;
        if (statusFilter === "EMPLOYEE_ISSUE" && ev.eventType !== "EMPLOYEE_ISSUE") return false;
        if (statusFilter === "EMPLOYEE_RETURN" && ev.eventType !== "EMPLOYEE_RETURN") return false;
      }
      if (startDate && new Date(ev.date) < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(ev.date) > end) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          ev.title.toLowerCase().includes(q) ||
          (ev.subtitle && ev.subtitle.toLowerCase().includes(q)) ||
          (ev.entityName && ev.entityName.toLowerCase().includes(q)) ||
          (ev.location && ev.location.toLowerCase().includes(q)) ||
          (ev.notes && ev.notes.toLowerCase().includes(q)) ||
          (ev.referenceNumber && ev.referenceNumber.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });

    // Chronological sorting (from 1st stock addition vs newest first)
    if (timelineOrder === "OLDEST_FIRST") {
      list = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      list = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return list;
  }, [data, statusFilter, startDate, endDate, searchQuery, timelineOrder]);

  // Active Employee Holders (Currently Holding)
  const activeHolders = useMemo(() => {
    if (!data) return [];
    return data.employeeHolders.filter((h) => h.holdingStatus !== "RETURNED");
  }, [data]);

  // Filtered Employee Holders
  const filteredHolders = useMemo(() => {
    if (!data) return [];
    return data.employeeHolders.filter((h) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "ACTIVE" && h.holdingStatus === "RETURNED") return false;
        if (statusFilter === "RETURNED" && h.holdingStatus !== "RETURNED") return false;
      }
      if (startDate && new Date(h.issueDate) < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(h.issueDate) > end) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          h.employeeName.toLowerCase().includes(q) ||
          (h.employeeDepartment && h.employeeDepartment.toLowerCase().includes(q)) ||
          h.issueNumber.toLowerCase().includes(q) ||
          (h.serialNumber && h.serialNumber.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [data, statusFilter, startDate, endDate, searchQuery]);

  // Filtered Movements
  const filteredMovements = useMemo(() => {
    if (!data) return [];
    return data.movements.filter((m) => {
      if (statusFilter !== "ALL" && m.movementType !== statusFilter) return false;
      if (startDate && new Date(m.createdAt) < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(m.createdAt) > end) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          m.reason.toLowerCase().includes(q) ||
          (m.entityName && m.entityName.toLowerCase().includes(q)) ||
          (m.referenceNumber && m.referenceNumber.toLowerCase().includes(q)) ||
          (m.warehouseName && m.warehouseName.toLowerCase().includes(q)) ||
          (m.rackName && m.rackName.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [data, statusFilter, startDate, endDate, searchQuery]);

  // Paginated Rows
  const paginatedItems = useMemo(() => {
    let list: unknown[] = [];
    if (activeTab === "LIFECYCLE") list = filteredLifecycle;
    else if (activeTab === "HOLDERS") list = filteredHolders;
    else if (activeTab === "STOCK") list = data?.inventoryLocations || [];
    else if (activeTab === "MOVEMENTS") list = filteredMovements;
    else if (activeTab === "RETURNS") list = data?.employeeHolders.filter((h) => h.holdingStatus === "RETURNED") || [];

    const start = (page - 1) * pageSize;
    return {
      total: list.length,
      rows: list.slice(start, start + pageSize),
    };
  }, [activeTab, filteredLifecycle, filteredHolders, data, filteredMovements, page, pageSize]);

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50/80 p-3 sm:p-5 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Top Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-500">Product Lifecycle & History</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              title="Print Product History"
            >
              <Printer className="h-4 w-4 text-slate-500" /> Print Lifecycle Report
            </button>
            <button
              type="button"
              onClick={() => router.push(`/employee-issues?pId=${encodeURIComponent(id)}`)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition active:scale-95"
            >
              <Users className="h-4 w-4" /> Issue to Employee
            </button>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="mt-3 text-sm font-semibold text-slate-600">
              Loading product inward arrival, employee custody, and return lifecycle...
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-xs">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
            <h3 className="mt-2 text-base font-bold text-red-800">Error Loading Product</h3>
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
            {/* ─── PRODUCT HERO HEADER ─── */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/30 p-5 md:p-7 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white font-black shadow-md">
                    <Package className="h-8 w-8" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl md:text-2xl font-extrabold text-slate-800">
                        {data.product.name}
                      </h1>
                      <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-700 border border-slate-200">
                        SKU: {data.product.sku}
                      </span>
                    </div>

                    {/* Arrival Date & Inward Banner */}
                    <div className="mt-2 flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs text-slate-600">
                      {arrivalInfo && (
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                          <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                          <span>First Arrived: <b>{arrivalInfo.formatted}</b></span>
                          <span className="text-emerald-700 font-normal">({arrivalInfo.supplier})</span>
                        </div>
                      )}

                      {data.product.category && (
                        <div className="flex items-center gap-1">
                          <Tag className="h-3.5 w-3.5 text-slate-400" />
                          <span>Category: <b className="text-slate-800">{data.product.category}</b></span>
                        </div>
                      )}

                      {data.product.price !== undefined && (
                        <div className="flex items-center gap-1">
                          <span>Unit Price: <b className="text-slate-800">₹{data.product.price.toLocaleString("en-IN")}</b></span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Status Pill: Current Position */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex items-center gap-4 min-w-[240px]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <History className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                      Current Stock Position
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-lg font-extrabold text-emerald-700">
                        {data.summary.totalInStock} In-Stock
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-lg font-extrabold text-blue-700">
                        {data.summary.totalUnitsActiveIssued} Issued
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      {data.summary.totalUnitsReturned} units returned to date
                    </span>
                  </div>
                </div>
              </div>

              {/* 🌟 CRYSTAL CLEAR 1ST STOCK ARRIVAL (ORIGIN RECORD) 🌟 */}
              {arrivalInfo && (
                <div className="mt-5 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-blue-50/40 p-4 sm:p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/70 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                        <Sparkles className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black uppercase tracking-wide text-emerald-950">
                            1st Stock Inward Arrival (Initial Origin Point)
                          </h3>
                          <span className="rounded-full bg-emerald-600 text-white px-2 py-0.2 text-[9px] font-extrabold uppercase">
                            Origin Step
                          </span>
                        </div>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          The very first day stock was received and entered into warehouse inventory
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-xl bg-white/95 border border-emerald-200 px-3 py-1.5 text-xs font-extrabold text-emerald-900 shadow-2xs flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-emerald-600" />
                        {arrivalInfo.formatted}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    <div className="rounded-xl bg-white/90 p-3 border border-emerald-100/90 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase text-emerald-700 block">Initial Received Quantity</span>
                      <p className="text-lg font-black text-emerald-900 mt-0.5">
                        +{arrivalInfo.quantity != null ? arrivalInfo.quantity : data.summary.totalInStock} <span className="text-xs font-normal text-emerald-600">units</span>
                      </p>
                      <span className="text-[10px] text-slate-400">First stock inward</span>
                    </div>

                    <div className="rounded-xl bg-white/90 p-3 border border-emerald-100/90 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase text-emerald-700 block">Initial Warehouse Location</span>
                      <p className="text-xs font-bold text-slate-800 mt-0.5 truncate" title={arrivalInfo.location || "Warehouse"}>
                        {arrivalInfo.warehouseName || "Warehouse"}
                      </p>
                      <span className="text-[10px] text-slate-500 block truncate">{arrivalInfo.rackName || "Rack"}</span>
                    </div>

                    <div className="rounded-xl bg-white/90 p-3 border border-emerald-100/90 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase text-emerald-700 block">Supplier / Vendor</span>
                      <p className="text-xs font-bold text-slate-800 mt-0.5 truncate" title={arrivalInfo.supplier}>
                        {arrivalInfo.supplier}
                      </p>
                      <span className="text-[10px] text-slate-500 block truncate">Ref: {arrivalInfo.referenceNumber || "INITIAL-STOCK"}</span>
                    </div>

                    <div className="rounded-xl bg-white/90 p-3 border border-emerald-100/90 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase text-emerald-700 block">Initial Stock Valuation</span>
                      <p className="text-xs font-bold text-emerald-800 mt-0.5">
                        ₹{(arrivalInfo.totalValue || (arrivalInfo.unitPrice || data.product.price || 0) * (arrivalInfo.quantity || 1)).toLocaleString("en-IN")}
                      </p>
                      <span className="text-[10px] text-slate-500 block">
                        @ ₹{(arrivalInfo.unitPrice || data.product.price || 0).toLocaleString("en-IN")}/unit
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ─── METRIC CARDS STRIP ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-2xs hover:bg-emerald-50/70 hover:border-emerald-300 transition-all duration-200">
                <span className="text-[10px] font-bold uppercase text-emerald-900/80 tracking-wider block">
                  Warehouse Stock
                </span>
                <p className="text-2xl font-black text-emerald-950 mt-0.5">
                  {data.summary.totalInStock}{" "}
                  <span className="text-xs font-semibold text-emerald-700">available</span>
                </p>
                <span className="text-[11px] text-emerald-700/80">Across warehouse racks</span>
              </div>

              <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4 shadow-2xs hover:bg-blue-50/70 hover:border-blue-300 transition-all duration-200">
                <span className="text-[10px] font-bold uppercase text-blue-900/80 tracking-wider block">
                  Currently With Employees
                </span>
                <p className="text-2xl font-black text-blue-950 mt-0.5">
                  {data.summary.totalUnitsActiveIssued}{" "}
                  <span className="text-xs font-semibold text-blue-700">active units</span>
                </p>
                <span className="text-[11px] text-blue-700/80 font-medium">
                  Held by {data.summary.activeHoldersCount} staff members
                </span>
              </div>

              <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-4 shadow-2xs hover:bg-indigo-50/70 hover:border-indigo-300 transition-all duration-200">
                <span className="text-[10px] font-bold uppercase text-indigo-900/80 tracking-wider block">
                  Total Ever Returned
                </span>
                <p className="text-2xl font-black text-indigo-950 mt-0.5">
                  {data.summary.totalUnitsReturned}{" "}
                  <span className="text-xs font-semibold text-indigo-700">units</span>
                </p>
                <span className="text-[11px] text-indigo-700/80">Restored back into inventory</span>
              </div>

              <div className="rounded-2xl border border-purple-200/80 bg-purple-50/40 p-4 shadow-2xs hover:bg-purple-50/70 hover:border-purple-300 transition-all duration-200">
                <span className="text-[10px] font-bold uppercase text-purple-900/80 tracking-wider block">
                  Total Movement Entries
                </span>
                <p className="text-2xl font-black text-purple-950 mt-0.5">
                  {data.summary.totalMovementRecords}{" "}
                  <span className="text-xs font-semibold text-purple-700">logs</span>
                </p>
                <span className="text-[11px] text-purple-700/80">Inward / Issues / Returns / Sales</span>
              </div>
            </div>

            {/* ─── MAIN TABS & DIRECTORY ─── */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              {/* Tabs */}
              <div className="border-b border-slate-200 bg-slate-50/60 p-2 sm:px-4 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("LIFECYCLE")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "LIFECYCLE"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <History className="h-3.5 w-3.5 text-blue-600" />
                  Chronological Lifecycle Timeline
                  <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.2 text-[10px] font-extrabold text-blue-800">
                    {data.lifecycleEvents.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("HOLDERS")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "HOLDERS"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Users className="h-3.5 w-3.5 text-indigo-600" />
                  Employee Custody & Allocation
                  <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.2 text-[10px] font-extrabold text-slate-700">
                    {data.employeeHolders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("STOCK")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "STOCK"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Warehouse className="h-3.5 w-3.5 text-emerald-600" />
                  Warehouse Stock & Racks
                  <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-extrabold text-emerald-800">
                    {data.inventoryLocations.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("MOVEMENTS")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "MOVEMENTS"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 text-slate-600" />
                  All Stock Movements
                  <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.2 text-[10px] font-extrabold text-slate-700">
                    {data.movements.length}
                  </span>
                </button>
              </div>

              {/* Filter controls */}
              <div className="border-b border-slate-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search title, employee, ref #, serial, location..."
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

                  {/* Status filter based on tab */}
                  {activeTab === "HOLDERS" && (
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Holders</option>
                      <option value="ACTIVE">Currently In Custody</option>
                      <option value="RETURNED">Returned to Stock</option>
                    </select>
                  )}

                  {activeTab === "MOVEMENTS" && (
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Movement Types</option>
                      <option value="INWARD">Inward Only</option>
                      <option value="OUTWARD">Outward Only</option>
                    </select>
                  )}

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

                  {(searchQuery || statusFilter !== "ALL" || startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("ALL");
                        setStartDate("");
                        setEndDate("");
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Clear Filters
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setTimelineOrder(
                        timelineOrder === "OLDEST_FIRST" ? "NEWEST_FIRST" : "OLDEST_FIRST"
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5 text-blue-600" />
                    {timelineOrder === "OLDEST_FIRST"
                      ? "From 1st Stock Addition (Day 1 → Today)"
                      : "Latest Activity First (Today → Day 1)"}
                  </button>
                </div>

                <div className="text-xs font-semibold text-slate-500">
                  Showing {paginatedItems.rows.length} of {paginatedItems.total} events
                </div>
              </div>

              {/* ─── TAB 1: LIFECYCLE TIMELINE ─── */}
              {activeTab === "LIFECYCLE" && (
                <div className="p-4 sm:p-6 space-y-4">
                  {filteredLifecycle.length === 0 ? (
                    <p className="p-8 text-center text-slate-400 text-sm">
                      No lifecycle events match your filter criteria.
                    </p>
                  ) : (
                    <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 space-y-6">
                      {(paginatedItems.rows as typeof filteredLifecycle).map((ev) => {
                        const isInitialStock = ev.isInitialStock || ev.eventType === "INITIAL_STOCK";
                        const isProductCreated = ev.eventType === "PRODUCT_CREATED";

                        const eventDate = new Date(ev.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        });

                        const iconBg = isInitialStock
                          ? "bg-emerald-600 text-white ring-4 ring-emerald-200"
                          : ev.eventType === "INWARD"
                          ? "bg-teal-600 text-white ring-4 ring-teal-100"
                          : ev.eventType === "EMPLOYEE_ISSUE"
                          ? "bg-blue-600 text-white ring-4 ring-blue-100"
                          : ev.eventType === "EMPLOYEE_RETURN"
                          ? "bg-cyan-600 text-white ring-4 ring-cyan-100"
                          : ev.eventType === "SERVICE"
                          ? "bg-amber-500 text-white ring-4 ring-amber-100"
                          : isProductCreated
                          ? "bg-slate-600 text-white ring-4 ring-slate-200"
                          : "bg-purple-600 text-white ring-4 ring-purple-100";

                        return (
                          <div key={ev.id} className="relative group">
                            {/* Dot on line */}
                            <div
                              className={`absolute -left-6 sm:-left-8 top-1 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full ${iconBg} shadow-xs`}
                            >
                              {isInitialStock ? (
                                <Sparkles className="h-3.5 w-3.5" />
                              ) : ev.eventType === "INWARD" ? (
                                <ArrowDownLeft className="h-3.5 w-3.5" />
                              ) : ev.eventType === "EMPLOYEE_ISSUE" ? (
                                <Users className="h-3.5 w-3.5" />
                              ) : ev.eventType === "EMPLOYEE_RETURN" ? (
                                <RotateCcw className="h-3.5 w-3.5" />
                              ) : ev.eventType === "SERVICE" ? (
                                <Wrench className="h-3.5 w-3.5" />
                              ) : (
                                <Package className="h-3.5 w-3.5" />
                              )}
                            </div>

                            <div
                              className={`rounded-xl border p-4 shadow-2xs transition ${
                                isInitialStock
                                  ? "border-2 border-emerald-400 bg-gradient-to-r from-emerald-50/80 via-white to-white ring-1 ring-emerald-200 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-extrabold text-slate-800 text-sm">{ev.title}</h4>
                                    {isInitialStock ? (
                                      <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide">
                                        🌟 1ST STOCK INWARD (ORIGIN)
                                      </span>
                                    ) : (
                                      <span
                                        className={`rounded-md px-2 py-0.2 text-[10px] font-extrabold uppercase ${
                                          ev.eventType === "INWARD"
                                            ? "bg-teal-50 text-teal-800 border border-teal-200"
                                            : ev.eventType === "EMPLOYEE_ISSUE"
                                            ? "bg-blue-50 text-blue-800 border border-blue-200"
                                            : ev.eventType === "EMPLOYEE_RETURN"
                                            ? "bg-cyan-50 text-cyan-800 border border-cyan-200"
                                            : ev.eventType === "SERVICE"
                                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                                            : "bg-slate-100 text-slate-700 border border-slate-200"
                                        }`}
                                      >
                                        {ev.eventType.replace("_", " ")}
                                      </span>
                                    )}
                                  </div>
                                  {ev.subtitle && (
                                    <p className="text-xs text-slate-500 mt-0.5">{ev.subtitle}</p>
                                  )}
                                </div>

                                <div className="text-right self-start sm:self-auto shrink-0">
                                  <span className="text-xs font-bold text-slate-700">{eventDate}</span>
                                  {ev.quantity > 0 && (
                                    <span
                                      className={`block text-xs font-black ${
                                        isInitialStock || ev.eventType === "INWARD" || ev.eventType === "EMPLOYEE_RETURN"
                                          ? "text-emerald-700"
                                          : "text-blue-700"
                                      }`}
                                    >
                                      {isInitialStock || ev.eventType === "INWARD" || ev.eventType === "EMPLOYEE_RETURN" ? "+" : "-"}
                                      {ev.quantity} unit{ev.quantity > 1 ? "s" : ""}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {(ev.location || ev.notes || ev.referenceNumber || ev.totalValue != null) && (
                                <div className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                                  {ev.location && (
                                    <span>
                                      Location: <b className="text-slate-800">{ev.location}</b>
                                    </span>
                                  )}
                                  {ev.totalValue != null && ev.totalValue > 0 && (
                                    <span>
                                      Stock Valuation: <b className="text-slate-800">₹{ev.totalValue.toLocaleString("en-IN")}</b>
                                    </span>
                                  )}
                                  {ev.referenceNumber && (
                                    <span>
                                      Ref: <b className="text-slate-800 font-mono">{ev.referenceNumber}</b>
                                    </span>
                                  )}
                                  {ev.notes && <span>Notes: {ev.notes}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB 2: EMPLOYEE CUSTODY & ALLOCATIONS ─── */}
              {activeTab === "HOLDERS" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Employee Name & Dept</th>
                        <th className="px-5 py-3">Issue # & Date</th>
                        <th className="px-5 py-3">Qty & Serial</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Return Due / Returned At</th>
                        <th className="px-5 py-3">Warehouse & Rack</th>
                        <th className="px-5 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHolders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No employee allocation records found for this product.
                          </td>
                        </tr>
                      ) : (
                        (paginatedItems.rows as typeof filteredHolders).map((h, idx) => {
                          const isReturned = h.holdingStatus === "RETURNED";
                          return (
                            <tr key={`${h.issueId}-${idx}`} className="hover:bg-slate-50/70 transition">
                              <td className="px-5 py-3.5">
                                <Link
                                  href={`/employee-issues/employee/${encodeURIComponent(h.employeeId || h.employeeName)}`}
                                  className="font-bold text-slate-800 hover:text-blue-600 hover:underline transition flex items-center gap-1 group"
                                  title="View complete employee asset history"
                                >
                                  <span>{h.employeeName}</span>
                                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-blue-600 transition" />
                                </Link>
                                <span className="text-[11px] text-slate-400 block">
                                  {h.employeeDepartment || "General"} {h.employeePhone && `• ${h.employeePhone}`}
                                </span>
                              </td>

                              <td className="px-5 py-3.5">
                                <span className="font-semibold text-blue-600">#{h.issueNumber}</span>
                                <span className="text-[11px] text-slate-400 block">
                                  {new Date(h.issueDate).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </td>

                              <td className="px-5 py-3.5">
                                <span className="font-bold text-slate-800">{h.quantity} units</span>
                                {h.serialNumber && (
                                  <span className="text-[10px] font-mono text-slate-500 block">
                                    SN: {h.serialNumber}
                                  </span>
                                )}
                              </td>

                              <td className="px-5 py-3.5">
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                                    isReturned
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : h.holdingStatus === "ACTIVE"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                                >
                                  {isReturned ? "RETURNED" : h.holdingStatus || "ACTIVE (IN CUSTODY)"}
                                </span>
                              </td>

                              <td className="px-5 py-3.5">
                                {isReturned ? (
                                  <div>
                                    <span className="font-semibold text-emerald-700">Returned</span>
                                    <span className="text-[11px] text-slate-400 block">
                                      {h.returnedAt
                                        ? new Date(h.returnedAt).toLocaleDateString("en-IN", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                          })
                                        : "Yes"}
                                    </span>
                                  </div>
                                ) : h.returnDueDate ? (
                                  <div>
                                    <span className="font-semibold text-slate-800">
                                      {new Date(h.returnDueDate).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">Permanent</span>
                                )}
                              </td>

                              <td className="px-5 py-3.5 text-slate-600">
                                {h.warehouseName} • {h.rackName}
                              </td>

                              <td className="px-5 py-3.5 text-center">
                                <Link
                                  href={`/employee-issues/employee/${encodeURIComponent(h.employeeId || h.employeeName)}`}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                                >
                                  Employee Custody
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ─── TAB 3: WAREHOUSE STOCK & RACKS ─── */}
              {activeTab === "STOCK" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Warehouse</th>
                        <th className="px-5 py-3">Rack & Bin</th>
                        <th className="px-5 py-3">Available Quantity</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.inventoryLocations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">
                            No warehouse stock allocations found for this product.
                          </td>
                        </tr>
                      ) : (
                        data.inventoryLocations.map((loc) => (
                          <tr key={loc.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-3.5">
                              <p className="font-bold text-slate-800">{loc.warehouse?.name || "Warehouse"}</p>
                              <span className="text-[11px] text-slate-400">{loc.warehouse?.code}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-slate-700">{loc.rack?.name || "Rack"}</p>
                              <span className="text-[11px] text-slate-400">{loc.rack?.code}</span>
                            </td>
                            <td className="px-5 py-3.5 font-bold text-emerald-700 text-sm">
                              {loc.quantity} units
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                  loc.quantity > 5
                                    ? "bg-emerald-50 text-emerald-700"
                                    : loc.quantity > 0
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {loc.status || (loc.quantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK")}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-slate-500">
                              {new Date(loc.updatedAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ─── TAB 4: ALL STOCK MOVEMENTS ─── */}
              {activeTab === "MOVEMENTS" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Reason</th>
                        <th className="px-5 py-3">Quantity</th>
                        <th className="px-5 py-3">Location</th>
                        <th className="px-5 py-3">Entity / Person</th>
                        <th className="px-5 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMovements.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No stock movement entries found.
                          </td>
                        </tr>
                      ) : (
                        (paginatedItems.rows as typeof filteredMovements).map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-3.5 text-slate-600">
                              {new Date(m.createdAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                  m.movementType === "INWARD"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                              >
                                {m.movementType}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-slate-700">
                              {m.reason.replace("_", " ")}
                            </td>
                            <td className="px-5 py-3.5 font-bold text-slate-800">
                              {m.quantity} units
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">
                              {m.warehouseName || "-"} • {m.rackName || "-"}
                            </td>
                            <td className="px-5 py-3.5 text-slate-700">
                              {m.entityName || m.performedByName || "-"}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500">
                              {m.notes || "-"}
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
      </div>
    </ProtectedPage>
  );
}
