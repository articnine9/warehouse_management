"use client";

import { useEffect, useState, useMemo } from "react";
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
  ArrowDownLeft,
  ArrowUpRight,
  Wrench,
  Sparkles,
  PackagePlus,
  ArrowUpDown,
  Search,
  Filter,
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
    serviceIntervalMonths?: number;
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
    activeHoldersCount: number;
  };
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
    "LIFECYCLE" | "HOLDERS" | "LOCATIONS" | "MOVEMENTS" | "AUDIT"
  >("LIFECYCLE");

  // Timeline filters & sorting
  const [timelineOrder, setTimelineOrder] = useState<"OLDEST_FIRST" | "NEWEST_FIRST">("OLDEST_FIRST");
  const [lifecycleFilter, setLifecycleFilter] = useState<"ALL" | "INWARD" | "EMPLOYEE_ISSUE" | "EMPLOYEE_RETURN" | "SERVICE">("ALL");
  const [lifecycleSearch, setLifecycleSearch] = useState("");

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
          setActiveTab("LIFECYCLE");
        }
      } catch (err) {
        console.error("Failed to load product history:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchProductHistory();
  }, [productId]);

  // Prepared filtered timeline events
  const filteredTimelineEvents = useMemo(() => {
    if (!data?.lifecycleEvents) return [];
    let list = data.lifecycleEvents.filter((ev) => {
      if (lifecycleFilter === "INWARD") {
        if (ev.eventType !== "INITIAL_STOCK" && ev.eventType !== "INWARD") return false;
      } else if (lifecycleFilter === "EMPLOYEE_ISSUE") {
        if (ev.eventType !== "EMPLOYEE_ISSUE") return false;
      } else if (lifecycleFilter === "EMPLOYEE_RETURN") {
        if (ev.eventType !== "EMPLOYEE_RETURN") return false;
      } else if (lifecycleFilter === "SERVICE") {
        if (ev.eventType !== "SERVICE") return false;
      }

      if (lifecycleSearch.trim()) {
        const q = lifecycleSearch.toLowerCase().trim();
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

    // Sort order
    if (timelineOrder === "OLDEST_FIRST") {
      list = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      list = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return list;
  }, [data?.lifecycleEvents, lifecycleFilter, lifecycleSearch, timelineOrder]);

  if (!productId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold shrink-0 shadow-sm">
              <Box className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">
                  {loading
                    ? "Loading Product History..."
                    : data?.product.name || "Product History"}
                </h2>
                {data?.product.productType === "REUSABLE" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                    <RotateCcw className="h-3 w-3" /> Reusable ({data.product.returnDays || 30}d)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    Standard Product
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>SKU: <b className="text-slate-700 font-mono">{data?.product.sku || "-"}</b></span>
                {data?.product.category && (
                  <span>• Category: <b className="text-slate-700">{data.product.category}</b></span>
                )}
                {data?.product.price != null && data.product.price > 0 && (
                  <span>• Price: <b className="text-slate-700">₹{data.product.price.toLocaleString("en-IN")}</b></span>
                )}
                {data?.product.sellerName && (
                  <span>• Supplier: <b className="text-slate-700">{data.product.sellerName}</b></span>
                )}
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
              Retrieving full top-to-bottom product history starting from 1st stock inward...
            </p>
          </div>
        )}

        {/* Content */}
        {!loading && data && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* 🌟 CRYSTAL CLEAR 1ST STOCK ARRIVAL (ORIGIN) BANNER 🌟 */}
            {data.initialStockArrival && (
              <div className="rounded-xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-blue-50/40 p-3.5 sm:p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-emerald-200/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-emerald-950">
                          1st Stock Inward Arrival (Origin Record)
                        </h3>
                        <span className="rounded-full bg-emerald-600 text-white px-2 py-0.2 text-[9px] font-extrabold uppercase">
                          Origin Step
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        First recorded entry into warehouse inventory
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="rounded-lg bg-white/90 border border-emerald-200 px-2.5 py-1 text-xs font-extrabold text-emerald-900 shadow-2xs flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-emerald-600" />
                      {new Date(data.initialStockArrival.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2.5 pt-0.5">
                  <div className="rounded-lg bg-white/80 p-2 border border-emerald-100/80">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">Initial Quantity</span>
                    <p className="text-base font-extrabold text-emerald-900 mt-0.5">
                      +{data.initialStockArrival.quantity} <span className="text-xs font-normal text-emerald-600">units</span>
                    </p>
                  </div>

                  <div className="rounded-lg bg-white/80 p-2 border border-emerald-100/80">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">Received At</span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 truncate" title={`${data.initialStockArrival.warehouseName} • ${data.initialStockArrival.rackName}`}>
                      {data.initialStockArrival.warehouseName}
                    </p>
                    <span className="text-[10px] text-slate-500 block truncate">{data.initialStockArrival.rackName}</span>
                  </div>

                  <div className="rounded-lg bg-white/80 p-2 border border-emerald-100/80">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">Supplier / Source</span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 truncate" title={data.initialStockArrival.supplier}>
                      {data.initialStockArrival.supplier}
                    </p>
                    <span className="text-[10px] text-slate-500 block truncate">Ref: {data.initialStockArrival.referenceNumber || "INITIAL-STOCK"}</span>
                  </div>

                  <div className="rounded-lg bg-white/80 p-2 border border-emerald-100/80">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">Initial Valuation</span>
                    <p className="text-xs font-bold text-emerald-800 mt-0.5">
                      ₹{data.initialStockArrival.totalValue.toLocaleString("en-IN")}
                    </p>
                    <span className="text-[10px] text-slate-500 block">
                      @ ₹{data.initialStockArrival.unitPrice.toLocaleString("en-IN")}/unit
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Top Stat Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                <p className="text-[10px] font-bold text-emerald-700 uppercase">Current In Stock</p>
                <p className="text-lg font-black text-emerald-800 mt-0.5">
                  {data.summary.totalInStock} <span className="text-xs font-normal text-slate-500">available</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Across {data.inventoryLocations.length} locations
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                <p className="text-[10px] font-bold text-blue-700 uppercase">With Employees</p>
                <p className="text-lg font-black text-blue-800 mt-0.5">
                  {data.summary.totalUnitsActiveIssued} <span className="text-xs font-normal text-slate-500">units</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {data.summary.activeHoldersCount} active holders
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                <p className="text-[10px] font-bold text-indigo-700 uppercase">Total Returned</p>
                <p className="text-lg font-black text-indigo-800 mt-0.5">
                  {data.summary.totalUnitsReturned} <span className="text-xs font-normal text-slate-500">units</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Restored to inventory
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-600 uppercase">Movement Logs</p>
                <p className="text-lg font-black text-slate-800 mt-0.5">
                  {data.summary.totalMovementRecords} <span className="text-xs font-normal text-slate-500">records</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  From Day 1 to Today
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("LIFECYCLE")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  activeTab === "LIFECYCLE"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <History className="h-3.5 w-3.5" />
                Lifecycle Timeline ({data.lifecycleEvents?.length || 0})
              </button>

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
                Employee Custody ({data.employeeHolders.length})
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
                <Shield className="h-3.5 w-3.5" />
                Audit ({data.changeLogs.length})
              </button>
            </div>

            {/* ─── TAB 0: CHRONOLOGICAL LIFECYCLE TIMELINE ─── */}
            {activeTab === "LIFECYCLE" && (
              <div className="space-y-3">
                {/* Filter and Order Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <div className="relative min-w-[160px] max-w-xs flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search event, person, voucher, note..."
                        value={lifecycleSearch}
                        onChange={(e) => setLifecycleSearch(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 py-1 text-xs outline-none focus:border-blue-500"
                      />
                      {lifecycleSearch && (
                        <button
                          type="button"
                          onClick={() => setLifecycleSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    <select
                      value={lifecycleFilter}
                      onChange={(e) => setLifecycleFilter(e.target.value as typeof lifecycleFilter)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Events</option>
                      <option value="INWARD">1st Inward & Restocks</option>
                      <option value="EMPLOYEE_ISSUE">Employee Issues</option>
                      <option value="EMPLOYEE_RETURN">Returns</option>
                      <option value="SERVICE">Service & Repairs</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-medium">Order:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setTimelineOrder(
                          timelineOrder === "OLDEST_FIRST" ? "NEWEST_FIRST" : "OLDEST_FIRST"
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                    >
                      <ArrowUpDown className="h-3 w-3 text-blue-600" />
                      {timelineOrder === "OLDEST_FIRST"
                        ? "From 1st Stock Addition (Day 1 → Now)"
                        : "Latest Activity First (Now → Day 1)"}
                    </button>
                  </div>
                </div>

                {/* Timeline rendering */}
                {filteredTimelineEvents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No timeline events match the filter criteria.
                  </div>
                ) : (
                  <div className="relative pl-7 sm:pl-8 before:absolute before:left-3.5 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 space-y-4 pt-1">
                    {filteredTimelineEvents.map((ev, idx) => {
                      const isInitialStock = ev.isInitialStock || ev.eventType === "INITIAL_STOCK";
                      const isProductCreated = ev.eventType === "PRODUCT_CREATED";

                      const formattedDate = new Date(ev.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });
                      const formattedTime = new Date(ev.date).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      const iconBg = isInitialStock
                        ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                        : ev.eventType === "INWARD"
                        ? "bg-teal-600 text-white ring-4 ring-teal-50"
                        : ev.eventType === "EMPLOYEE_ISSUE"
                        ? "bg-blue-600 text-white ring-4 ring-blue-50"
                        : ev.eventType === "EMPLOYEE_RETURN"
                        ? "bg-cyan-600 text-white ring-4 ring-cyan-50"
                        : ev.eventType === "SERVICE"
                        ? "bg-amber-500 text-white ring-4 ring-amber-50"
                        : isProductCreated
                        ? "bg-slate-600 text-white ring-4 ring-slate-100"
                        : "bg-purple-600 text-white ring-4 ring-purple-50";

                      return (
                        <div key={ev.id || idx} className="relative group">
                          {/* Dot on line */}
                          <div
                            className={`absolute -left-7 sm:-left-8 top-1.5 flex h-7 w-7 items-center justify-center rounded-full ${iconBg} shadow-xs`}
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
                              <Box className="h-3.5 w-3.5" />
                            )}
                          </div>

                          {/* Event Card */}
                          <div
                            className={`rounded-xl border p-3.5 shadow-2xs transition ${
                              isInitialStock
                                ? "border-emerald-300 bg-gradient-to-r from-emerald-50/70 via-white to-white ring-1 ring-emerald-200"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">
                                    {ev.title}
                                  </h4>
                                  {isInitialStock ? (
                                    <span className="rounded-full bg-emerald-600 text-white px-2 py-0.2 text-[9px] font-extrabold uppercase">
                                      🌟 1ST STOCK ADDED
                                    </span>
                                  ) : (
                                    <span
                                      className={`rounded-md px-2 py-0.2 text-[9px] font-bold uppercase ${
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
                                  <p className="text-[11px] text-slate-500 mt-0.5">{ev.subtitle}</p>
                                )}
                              </div>

                              <div className="text-left sm:text-right self-start sm:self-auto shrink-0">
                                <span className="text-xs font-bold text-slate-700">
                                  {formattedDate}
                                </span>
                                <span className="text-[10px] text-slate-400 block">{formattedTime}</span>
                                {ev.quantity > 0 && (
                                  <span
                                    className={`inline-block text-[11px] font-extrabold mt-0.5 ${
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

                            {/* Details footer */}
                            {(ev.location || ev.notes || ev.referenceNumber || ev.totalValue != null) && (
                              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                                {ev.location && (
                                  <span>
                                    Location: <b className="text-slate-700">{ev.location}</b>
                                  </span>
                                )}
                                {ev.totalValue != null && ev.totalValue > 0 && (
                                  <span>
                                    Valuation: <b className="text-slate-700">₹{ev.totalValue.toLocaleString("en-IN")}</b>
                                  </span>
                                )}
                                {ev.referenceNumber && (
                                  <span>
                                    Ref: <b className="text-slate-700 font-mono">{ev.referenceNumber}</b>
                                  </span>
                                )}
                                {ev.notes && (
                                  <span className="text-slate-600">
                                    Notes: {ev.notes}
                                  </span>
                                )}
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
                        {data.movements.map((m) => {
                          const isInitialStock = m.reason === "INITIAL_STOCK";
                          return (
                            <tr
                              key={m.id}
                              className={`hover:bg-slate-50/60 ${
                                isInitialStock ? "bg-emerald-50/30 font-medium" : ""
                              }`}
                            >
                              <td className="p-3 text-slate-500 text-[11px]">
                                {new Date(m.createdAt).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {isInitialStock ? (
                                    <span className="rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[9px] font-extrabold uppercase flex items-center gap-1">
                                      <Sparkles className="h-2.5 w-2.5" /> 1ST STOCK ADDED
                                    </span>
                                  ) : (
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        m.movementType === "INWARD"
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : "bg-amber-50 text-amber-700 border border-amber-200"
                                      }`}
                                    >
                                      {m.movementType}
                                    </span>
                                  )}
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
                          );
                        })}
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
