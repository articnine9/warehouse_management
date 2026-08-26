"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Filter,
  Search,
  Download,
  RotateCcw,
  Box,
  TrendingUp,
  TrendingDown,
  Layers,
  FileSpreadsheet,
} from "lucide-react";

type StockMovementItem = {
  _id: string;
  productId: {
    _id: string;
    name: string;
    sku: string;
    category?: string;
    price?: number;
  };
  productName: string;
  sku: string;
  category?: string;
  warehouseName?: string;
  rackName?: string;
  movementType: "INWARD" | "OUTWARD";
  reason:
    | "INITIAL_STOCK"
    | "RESTOCK"
    | "EMPLOYEE_RETURN"
    | "EMPLOYEE_ISSUE"
    | "INVOICE_SALE"
    | "ADJUSTMENT";
  quantity: number;
  unitPrice: number;
  totalValue: number;
  serialNumber?: string;
  referenceNumber?: string;
  entityName?: string;
  notes?: string;
  performedByName?: string;
  createdAt: string;
};

type Metrics = {
  totalInwardUnits: number;
  totalInwardValue: number;
  totalOutwardUnits: number;
  totalOutwardValue: number;
  netFlowUnits: number;
  netFlowValue: number;
  totalRecords: number;
};

type WarehouseOption = {
  _id: string;
  name: string;
  code: string;
};

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalInwardUnits: 0,
    totalInwardValue: 0,
    totalOutwardUnits: 0,
    totalOutwardValue: 0,
    netFlowUnits: 0,
    netFlowValue: 0,
    totalRecords: 0,
  });
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [period, setPeriod] = useState<string>("this_month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [singleDate, setSingleDate] = useState<string>("");
  const [movementType, setMovementType] = useState<string>("ALL");
  const [reason, setReason] = useState<string>("ALL");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch("/api/warehouses");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setWarehouses(json.data);
      }
    } catch (e) {
      console.error("Failed to load warehouses:", e);
    }
  }, []);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(pageSize));

      if (period) params.set("period", period);
      if (period === "custom") {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      } else if (period === "single_day") {
        if (singleDate) params.set("singleDate", singleDate);
      }

      if (movementType !== "ALL") params.set("type", movementType);
      if (reason !== "ALL") params.set("reason", reason);
      if (selectedWarehouse !== "ALL") params.set("warehouseId", selectedWarehouse);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const res = await fetch(`/api/movements?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setMovements(json.data || []);
        if (json.metrics) setMetrics(json.metrics);
        if (json.pagination) setTotalCount(json.pagination.total);
      }
    } catch (e) {
      console.error("Failed to load movements:", e);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    pageSize,
    period,
    startDate,
    endDate,
    singleDate,
    movementType,
    reason,
    selectedWarehouse,
    searchQuery,
  ]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [period, startDate, endDate, singleDate, movementType, reason, selectedWarehouse, searchQuery, pageSize]);

  function getReasonBadge(mReason: StockMovementItem["reason"]) {
    switch (mReason) {
      case "INITIAL_STOCK":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
            <Box className="h-3 w-3" /> Initial Stock
          </span>
        );
      case "RESTOCK":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <ArrowDownLeft className="h-3 w-3" /> Restock / Addition
          </span>
        );
      case "EMPLOYEE_RETURN":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
            <RotateCcw className="h-3 w-3" /> Employee Return
          </span>
        );
      case "EMPLOYEE_ISSUE":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <ArrowUpRight className="h-3 w-3" /> Employee Issue
          </span>
        );
      case "INVOICE_SALE":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
            <ArrowUpRight className="h-3 w-3" /> Invoice Sale
          </span>
        );
      case "ADJUSTMENT":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
            Adjustment
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {mReason}
          </span>
        );
    }
  }

  function exportCSV() {
    if (movements.length === 0) return;
    const headers = [
      "Date & Time",
      "Type",
      "Reason",
      "Product Name",
      "SKU",
      "Category",
      "Quantity",
      "Unit Price (INR)",
      "Total Value (INR)",
      "Serial Number",
      "Reference Number",
      "Entity / Destination",
      "Warehouse / Location",
      "Notes",
    ];

    const rows = movements.map((m) => [
      new Date(m.createdAt).toLocaleString("en-IN"),
      m.movementType,
      m.reason,
      `"${(m.productName || "").replace(/"/g, '""')}"`,
      m.sku || "",
      m.category || "",
      m.quantity,
      m.unitPrice || 0,
      m.totalValue || 0,
      m.serialNumber || "",
      m.referenceNumber || "",
      `"${(m.entityName || "").replace(/"/g, '""')}"`,
      `"${(m.warehouseName || "")} ${m.rackName ? `/ ${m.rackName}` : ""}"`,
      `"${(m.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `stock_movements_${period}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const periodLabel = useMemo(() => {
    switch (period) {
      case "today":
        return "Today";
      case "yesterday":
        return "Yesterday";
      case "this_week":
        return "This Week";
      case "this_month":
        return "This Month";
      case "last_month":
        return "Last Month";
      case "this_year":
        return "This Year";
      case "single_day":
        return singleDate ? `Day: ${singleDate}` : "Single Day";
      case "custom":
        return startDate && endDate
          ? `${startDate} to ${endDate}`
          : "Custom Date Range";
      default:
        return "Selected Period";
    }
  }, [period, singleDate, startDate, endDate]);

  return (
    <ProtectedPage allowedRoles={["ADMIN", "STAFF"]}>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl flex items-center gap-2">
              <Layers className="h-7 w-7 text-blue-600" />
              Stock Movement Hub
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track incoming (Inward) and outgoing (Outward) product flows by month, day, or custom date range.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={movements.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export CSV
            </button>
          </div>
        </div>

        {/* Quick Date Presets Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Date Period:
            </span>

            {[
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "this_week", label: "This Week" },
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "this_year", label: "This Year" },
              { id: "single_day", label: "Single Day..." },
              { id: "custom", label: "Custom Range..." },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setPeriod(preset.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  period === preset.id
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Conditional Date Pickers */}
          {period === "single_day" && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-600">Select Date:</label>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium outline-none focus:border-blue-500"
              />
            </div>
          )}

          {period === "custom" && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">From:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">To:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* KPI Metrics Banner */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Inward */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase">Incoming Products</span>
              <div className="rounded-full bg-emerald-100 p-1.5 text-emerald-700">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1 text-2xl font-extrabold text-emerald-700">
              +{metrics.totalInwardUnits.toLocaleString("en-IN")} Units
            </p>
            <p className="mt-0.5 text-xs font-semibold text-emerald-800">
              Value: ₹{metrics.totalInwardValue.toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] text-emerald-600 mt-1">Stock additions, restocks & returns ({periodLabel})</p>
          </div>

          {/* Total Outward */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 uppercase">Outgoing Products</span>
              <div className="rounded-full bg-amber-100 p-1.5 text-amber-700">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1 text-2xl font-extrabold text-amber-700">
              -{metrics.totalOutwardUnits.toLocaleString("en-IN")} Units
            </p>
            <p className="mt-0.5 text-xs font-semibold text-amber-800">
              Value: ₹{metrics.totalOutwardValue.toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] text-amber-600 mt-1">Employee issues & invoice sales ({periodLabel})</p>
          </div>

          {/* Net Flow */}
          <div
            className={`rounded-xl border p-4 shadow-sm ${
              metrics.netFlowUnits >= 0
                ? "border-blue-200 bg-blue-50/50"
                : "border-rose-200 bg-rose-50/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold uppercase ${
                  metrics.netFlowUnits >= 0 ? "text-blue-800" : "text-rose-800"
                }`}
              >
                Net Stock Balance
              </span>
              <div
                className={`rounded-full p-1.5 ${
                  metrics.netFlowUnits >= 0
                    ? "bg-blue-100 text-blue-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {metrics.netFlowUnits >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
              </div>
            </div>
            <p
              className={`mt-1 text-2xl font-extrabold ${
                metrics.netFlowUnits >= 0 ? "text-blue-700" : "text-rose-700"
              }`}
            >
              {metrics.netFlowUnits >= 0 ? "+" : ""}
              {metrics.netFlowUnits.toLocaleString("en-IN")} Units
            </p>
            <p
              className={`mt-0.5 text-xs font-semibold ${
                metrics.netFlowUnits >= 0 ? "text-blue-800" : "text-rose-800"
              }`}
            >
              Net Value: ₹{metrics.netFlowValue.toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Net accumulation vs reduction</p>
          </div>

          {/* Total Transactions */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase">Movement Records</span>
              <div className="rounded-full bg-slate-100 p-1.5 text-slate-700">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1 text-2xl font-extrabold text-slate-800">
              {metrics.totalRecords.toLocaleString("en-IN")}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Audit entries recorded</p>
            <p className="text-[11px] text-slate-400 mt-1">Filtered across {periodLabel}</p>
          </div>
        </div>

        {/* Movement Table Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Filters Bar */}
          <div className="border-b border-slate-100 p-4 space-y-3">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              {/* Type Filter Buttons */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 self-start">
                <button
                  type="button"
                  onClick={() => setMovementType("ALL")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    movementType === "ALL"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  All ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType("INWARD")}
                  className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition ${
                    movementType === "INWARD"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  <ArrowDownLeft className="h-3 w-3" /> Inward (Incoming)
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType("OUTWARD")}
                  className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition ${
                    movementType === "OUTWARD"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-amber-700 hover:bg-amber-50"
                  }`}
                >
                  <ArrowUpRight className="h-3 w-3" /> Outward (Outgoing)
                </button>
              </div>

              {/* Reason, Warehouse, Search */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 font-medium text-slate-700"
                >
                  <option value="ALL">All Reasons</option>
                  <option value="RESTOCK">Restock / Additions</option>
                  <option value="INITIAL_STOCK">Initial Stock</option>
                  <option value="EMPLOYEE_RETURN">Employee Returns</option>
                  <option value="EMPLOYEE_ISSUE">Employee Issues</option>
                  <option value="INVOICE_SALE">Invoice Sales</option>
                  <option value="ADJUSTMENT">Stock Adjustments</option>
                </select>

                {warehouses.length > 0 && (
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 font-medium text-slate-700"
                  >
                    <option value="ALL">All Warehouses</option>
                    {warehouses.map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                )}

                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search product, SKU, serial, person..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500 w-56"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading movement history...
            </div>
          )}

          {/* Desktop Table */}
          {!loading && movements.length > 0 && (
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Date & Time</th>
                    <th className="px-5 py-3">Flow Type</th>
                    <th className="px-5 py-3">Product Name</th>
                    <th className="px-5 py-3">SKU / Serial</th>
                    <th className="px-5 py-3 text-right">Quantity</th>
                    <th className="px-5 py-3 text-right">Value (₹)</th>
                    <th className="px-5 py-3">Entity / Customer / Employee</th>
                    <th className="px-5 py-3">Ref & Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m) => (
                    <tr key={m._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {new Date(m.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>

                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {m.movementType === "INWARD" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                              <ArrowDownLeft className="h-3 w-3" /> INWARD (IN)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                              <ArrowUpRight className="h-3 w-3" /> OUTWARD (OUT)
                            </span>
                          )}
                          {getReasonBadge(m.reason)}
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-800">{m.productName}</p>
                        {m.category && (
                          <span className="text-[11px] text-slate-400 font-medium">{m.category}</span>
                        )}
                      </td>

                      <td className="px-5 py-3 text-xs font-mono">
                        <div className="text-slate-700 font-semibold">{m.sku}</div>
                        {m.serialNumber && (
                          <div className="text-[11px] text-purple-600 bg-purple-50 rounded px-1 mt-0.5 inline-block">
                            SN: {m.serialNumber}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3 text-right">
                        <span
                          className={`font-bold text-sm ${
                            m.movementType === "INWARD" ? "text-emerald-600" : "text-amber-700"
                          }`}
                        >
                          {m.movementType === "INWARD" ? "+" : "-"}
                          {m.quantity}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-right text-xs font-medium text-slate-800">
                        ₹{(m.totalValue || 0).toLocaleString("en-IN")}
                      </td>

                      <td className="px-5 py-3 text-xs text-slate-700">
                        <p className="font-semibold">{m.entityName || "-"}</p>
                        {m.performedByName && (
                          <p className="text-[11px] text-slate-400">By: {m.performedByName}</p>
                        )}
                      </td>

                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {m.referenceNumber && (
                          <span className="font-semibold text-slate-700 block">
                            {m.referenceNumber}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {m.warehouseName || "Warehouse"} {m.rackName ? `/ ${m.rackName}` : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile / Tablet Cards */}
          {!loading && movements.length > 0 && (
            <div className="space-y-3 p-4 lg:hidden">
              {movements.map((m) => (
                <div
                  key={m._id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-800">{m.productName}</p>
                      <p className="text-xs font-mono text-slate-500">SKU: {m.sku}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-extrabold text-base ${
                          m.movementType === "INWARD" ? "text-emerald-600" : "text-amber-700"
                        }`}
                      >
                        {m.movementType === "INWARD" ? "+" : "-"}
                        {m.quantity} Units
                      </span>
                      <p className="text-xs font-semibold text-slate-700">
                        ₹{(m.totalValue || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 items-center">
                    {m.movementType === "INWARD" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                        <ArrowDownLeft className="h-3 w-3" /> INWARD
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                        <ArrowUpRight className="h-3 w-3" /> OUTWARD
                      </span>
                    )}
                    {getReasonBadge(m.reason)}
                    {m.serialNumber && (
                      <span className="text-[11px] font-mono text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5">
                        SN: {m.serialNumber}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 flex flex-col gap-1">
                    {m.entityName && (
                      <div>
                        Destination / Entity: <b>{m.entityName}</b>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>
                        {new Date(m.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span>{m.referenceNumber || m.warehouseName}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && movements.length === 0 && (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Box className="h-10 w-10 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No stock movements found</p>
              <p className="text-xs text-slate-400">
                Try selecting a different date period or clearing filters.
              </p>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalCount > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(s) => setPageSize(s)}
              pageSizeOptions={[10, 15, 25, 50, 100]}
            />
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}
