"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  History,
  Search,
  RotateCcw,
  Wrench,
  PackageCheck,
  Printer,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
  Eye,
  Info,
  Box,
} from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import WarningPopup from "@/app/components/WarningPopup";
import IssueBillModal, { IssueBillData } from "@/app/components/IssueBillModal";
import ProductHistoryModal from "@/app/components/ProductHistoryModal";
import EmployeeHistoryModal from "@/app/components/EmployeeHistoryModal";
import ServiceCycleModal from "@/app/employee-issues/ServiceCycleModal";
import {
  reasonLabels,
  type Employee,
  type EmployeeIssue,
  type SelectedLineItem,
} from "@/app/employee-issues/types";

/** Helper to filter line items inside an issue based on active filters */
function getMatchingItems(
  issue: EmployeeIssue,
  typeFilter: string,
  stFilter: string,
  search: string
): SelectedLineItem[] {
  const q = search.trim().toLowerCase();
  const issueMatchesSearch =
    !q ||
    issue.issueNumber.toLowerCase().includes(q) ||
    issue.employeeName.toLowerCase().includes(q) ||
    issue.employeeEmail.toLowerCase().includes(q) ||
    issue.employeePhone?.toLowerCase().includes(q) ||
    issue.employeeDepartment?.toLowerCase().includes(q) ||
    issue.siteName?.toLowerCase().includes(q) ||
    (reasonLabels[issue.reason] || issue.reason).toLowerCase().includes(q) ||
    issue.issuedByName?.toLowerCase().includes(q);

  return issue.items.filter((item) => {
    // 1. Status Filter
    if (stFilter !== "ALL") {
      const itemStatus = item.holdingStatus || "ACTIVE";
      if (itemStatus !== stFilter) return false;
    }

    // 2. Product Type Filter (Returnable vs Non-Returnable)
    const isReusable = item.productType === "REUSABLE" || Boolean(item.returnDueDate);
    if (typeFilter === "REUSABLE" && !isReusable) return false;
    if (typeFilter === "NON_REUSABLE" && isReusable) return false;

    // 3. Search query: if search query didn't match issue globally, item must match
    if (q && !issueMatchesSearch) {
      const matchItem =
        item.productName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.serialNumber?.toLowerCase().includes(q) ||
        item.warehouseName?.toLowerCase().includes(q) ||
        item.rackName?.toLowerCase().includes(q);
      if (!matchItem) return false;
    }

    return true;
  });
}

export default function AssetHistoryPage() {
  const [issues, setIssues] = useState<EmployeeIssue[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [issueTypeFilter, setIssueTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Group Expand / Collapse State
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());
  // Option to show all items inside a filtered issue if user explicitly chooses
  const [showAllInIssueIds, setShowAllInIssueIds] = useState<Set<string>>(new Set());

  // Modals
  const [billIssue, setBillIssue] = useState<IssueBillData | null>(null);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [historyEmployee, setHistoryEmployee] = useState<string | null>(null);
  const [activeModalIssue, setActiveModalIssue] = useState<{
    issueId: string;
    itemIndex: number;
  } | null>(null);

  function toggleExpandIssue(issueId: string) {
    setExpandedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  }

  function toggleShowAllInIssue(issueId: string) {
    setShowAllInIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  }

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch("/api/employee-issues", { cache: "no-store" });
      const result = await res.json();
      if (result.success) {
        setIssues(result.data || []);
        setEmployees(result.employees || []);
      }
    } catch (error) {
      console.error("Failed to load asset history:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
  }, []);

  const lookupEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Overall metrics across all issues and line items
  const stats = useMemo(() => {
    let totalActive = 0;
    let totalInService = 0;
    let totalReturned = 0;
    let totalReusable = 0;
    let totalOverdue = 0;
    let totalValue = 0;
    let totalUnits = 0;

    const today = new Date().setHours(0, 0, 0, 0);

    for (const issue of issues) {
      for (const item of issue.items) {
        const q = item.quantity || 1;
        totalUnits += q;
        const status = item.holdingStatus || "ACTIVE";
        const isReusable = item.productType === "REUSABLE" || Boolean(item.returnDueDate);

        if (status === "ACTIVE") {
          totalActive += q;
          totalValue += (item.unitPrice || 0) * q;
        } else if (status === "UNDER_SERVICE") {
          totalInService += q;
          totalValue += (item.unitPrice || 0) * q;
        } else if (status === "RETURNED") {
          totalReturned += q;
        }

        if (isReusable && status !== "RETURNED") {
          totalReusable += q;
          if (item.returnDueDate) {
            const due = new Date(item.returnDueDate).setHours(0, 0, 0, 0);
            if (due < today) {
              totalOverdue += q;
            }
          }
        }
      }
    }

    return {
      totalIssues: issues.length,
      totalUnits,
      totalActive,
      totalInService,
      totalReturned,
      totalReusable,
      totalOverdue,
      totalValue,
    };
  }, [issues]);

  // Filtered issues:
  // Includes any issue that has at least 1 matching item under active Returnable/Non-Returnable/Status/Search filters.
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // 1. Employee filter
      if (selectedEmployeeId) {
        const matchId = issue.employeeId === selectedEmployeeId;
        const matchName =
          lookupEmployee &&
          issue.employeeName.toLowerCase() === lookupEmployee.name.toLowerCase();
        if (!matchId && !matchName) return false;
      }

      // 2. Date range filter
      if (dateFrom) {
        const d = new Date(issue.createdAt);
        if (d < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        const d = new Date(issue.createdAt);
        if (d > end) return false;
      }

      // 3. Matching Items check (Smart filtering by Returnable / Non-Returnable / Status / Search)
      const matching = getMatchingItems(issue, issueTypeFilter, statusFilter, searchQuery);
      return matching.length > 0;
    });
  }, [
    issues,
    selectedEmployeeId,
    lookupEmployee,
    statusFilter,
    issueTypeFilter,
    dateFrom,
    dateTo,
    searchQuery,
  ]);

  // Reset pagination on filter change
  useEffect(() => {
    setPage(1);
  }, [
    selectedEmployeeId,
    statusFilter,
    issueTypeFilter,
    searchQuery,
    dateFrom,
    dateTo,
    pageSize,
  ]);

  const paginatedIssues = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredIssues.slice(start, start + pageSize);
  }, [filteredIssues, page, pageSize]);

  function expandAll() {
    setExpandedIssueIds(new Set(filteredIssues.map((i) => i._id)));
  }

  function collapseAll() {
    setExpandedIssueIds(new Set());
  }

  function openBill(issue: EmployeeIssue) {
    const emp = employees.find(
      (e) =>
        e.id === issue.employeeId ||
        e.name.toLowerCase() === issue.employeeName.toLowerCase()
    );
    setBillIssue({
      _id: issue._id,
      issueNumber: issue.issueNumber,
      createdAt: issue.createdAt,
      employeeName: issue.employeeName,
      employeeCode: emp?.employeeCode,
      employeeDepartment: issue.employeeDepartment || emp?.department,
      employeePhone: issue.employeePhone || emp?.phone,
      employeeEmail: issue.employeeEmail || emp?.email,
      employeeDesignation: emp?.designation,
      reason: issue.reason,
      siteName: issue.siteName,
      notes: issue.notes,
      issuedByName: issue.issuedByName,
      items: issue.items.map((it) => ({
        productId: it.productId?.toString(),
        productName: it.productName,
        sku: it.sku,
        serialNumber: it.serialNumber,
        warehouseName: it.warehouseName,
        rackName: it.rackName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalValue: it.totalValue,
        productType: it.productType,
        returnDueDays: it.returnDueDays,
        returnDueDate: it.returnDueDate,
        serviceIntervalMonths: it.serviceIntervalMonths,
        holdingStatus: it.holdingStatus,
      })),
      totalQuantity: issue.totalQuantity,
      totalValue: issue.totalValue,
    });
  }

  const activeModalData = useMemo(() => {
    if (!activeModalIssue) return null;
    const issue = issues.find((i) => i._id === activeModalIssue.issueId);
    if (!issue || !issue.items[activeModalIssue.itemIndex]) return null;
    return { issue, itemIndex: activeModalIssue.itemIndex };
  }, [activeModalIssue, issues]);

  function handleIssueUpdated(updatedIssue: EmployeeIssue) {
    setIssues((prev) =>
      prev.map((i) => (i._id === updatedIssue._id ? updatedIssue : i))
    );
    setActiveModalIssue(null);
  }

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
                  Asset Movement & History
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track employee custody lifecycles, asset handovers, grouped issue batches, and return logs.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition print:hidden"
            >
              <Printer className="h-4 w-4 text-slate-500" /> Print Custody Report
            </button>
            <Link
              href="/employee-issues"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition active:scale-95 print:hidden"
            >
              <PackageCheck className="h-4 w-4" /> + Issue Product to Employee
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 print:hidden">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Active In Custody</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.totalActive}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Holding items</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">In Maintenance</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{stats.totalInService}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Service active</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Returnable on Loan</p>
            <p className="mt-1 text-2xl font-bold text-indigo-600">{stats.totalReusable}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {stats.totalOverdue > 0 ? (
                <span className="font-bold text-red-600">{stats.totalOverdue} overdue</span>
              ) : (
                "Due dates tracked"
              )}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Returned to Rack</p>
            <p className="mt-1 text-2xl font-bold text-slate-700">{stats.totalReturned}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Restocked assets</p>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Active Custody Value</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              ₹{stats.totalValue.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {stats.totalIssues} vouchers • {stats.totalUnits} units
            </p>
          </div>
        </div>

        {/* Directory Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Filter Bar */}
          <div className="border-b border-slate-100 p-4 md:p-5 space-y-3.5 print:hidden">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search employee, product, SKU, serial no, issue #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-4 py-2 text-xs font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Employee Filter */}
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="">All Employees ({employees.length})</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeCode} - {emp.name} ({emp.department || "General"})
                    </option>
                  ))}
                </select>

                {/* Product Type Toggle (Returnable / Non-Returnable / All) */}
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100/80">
                  <button
                    type="button"
                    onClick={() => setIssueTypeFilter("ALL")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      issueTypeFilter === "ALL"
                        ? "bg-slate-800 text-white shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All Types
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueTypeFilter("REUSABLE")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1 ${
                      issueTypeFilter === "REUSABLE"
                        ? "bg-indigo-600 text-white shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Filter only returnable assets"
                  >
                    <RotateCcw className="h-3 w-3" /> Returnable
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueTypeFilter("NON_REUSABLE")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1 ${
                      issueTypeFilter === "NON_REUSABLE"
                        ? "bg-amber-600 text-white shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Filter non-returnable materials"
                  >
                    <Box className="h-3 w-3" /> Non-Returnable
                  </button>
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Custody</option>
                  <option value="UNDER_SERVICE">In Service</option>
                  <option value="RETURNED">Returned</option>
                  <option value="DAMAGED">Damaged</option>
                </select>
              </div>
            </div>

            {/* Date Range, Expand/Collapse & Reset Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Date Range:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
                />

                {(selectedEmployeeId ||
                  statusFilter !== "ALL" ||
                  issueTypeFilter !== "ALL" ||
                  searchQuery ||
                  dateFrom ||
                  dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployeeId("");
                      setStatusFilter("ALL");
                      setIssueTypeFilter("ALL");
                      setSearchQuery("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Bulk Expand / Collapse Buttons */}
              {filteredIssues.length > 0 && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={expandAll}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition shadow-2xs"
                    title="Expand all product groups to view details"
                  >
                    Expand All Details
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition shadow-2xs"
                    title="Collapse all product groups"
                  >
                    Collapse All
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Issue # & Date</th>
                  <th className="px-5 py-3">Employee (Holder)</th>
                  <th className="px-5 py-3">Products & Quantity</th>
                  <th className="px-5 py-3 text-center">Custody Status</th>
                  <th className="px-5 py-3">Return / Renew Due</th>
                  <th className="px-5 py-3 text-center print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                      <p>Loading asset movement records...</p>
                    </td>
                  </tr>
                ) : paginatedIssues.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      No matching asset custody records found.
                    </td>
                  </tr>
                ) : (
                  paginatedIssues.map((issue) => {
                    const isExpanded = expandedIssueIds.has(issue._id);
                    const showAllInThisIssue = showAllInIssueIds.has(issue._id);

                    // 🎯 SMART ITEM FILTERING:
                    // Extract items matching active filters (Returnable, Non-Returnable, Status, Search)
                    const matchingItems = getMatchingItems(
                      issue,
                      issueTypeFilter,
                      statusFilter,
                      searchQuery
                    );

                    const isFilterActive =
                      issueTypeFilter !== "ALL" ||
                      statusFilter !== "ALL" ||
                      searchQuery.trim() !== "";
                    const isSubFiltered =
                      isFilterActive && matchingItems.length < issue.items.length;

                    // Items used for calculating main row summaries:
                    const summaryItems = isSubFiltered ? matchingItems : issue.items;

                    const totalSummaryUnits = summaryItems.reduce(
                      (acc, it) => acc + (it.quantity || 1),
                      0
                    );
                    const totalVoucherUnits = issue.items.reduce(
                      (acc, it) => acc + (it.quantity || 1),
                      0
                    );

                    const issuedDate = new Date(issue.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                    // Return due date calculation (based on active matching items)
                    const activeReturnables = summaryItems.filter(
                      (it) =>
                        (it.productType === "REUSABLE" || Boolean(it.returnDueDate)) &&
                        it.holdingStatus !== "RETURNED" &&
                        it.returnDueDate
                    );

                    let earliestReturnItem: SelectedLineItem | null = null;
                    let returnDaysLeft: number | null = null;
                    if (activeReturnables.length > 0) {
                      const sorted = [...activeReturnables].sort(
                        (a, b) =>
                          new Date(a.returnDueDate!).getTime() -
                          new Date(b.returnDueDate!).getTime()
                      );
                      earliestReturnItem = sorted[0];
                      const dueTime = new Date(earliestReturnItem.returnDueDate!).setHours(
                        0,
                        0,
                        0,
                        0
                      );
                      const nowTime = new Date().setHours(0, 0, 0, 0);
                      returnDaysLeft = Math.round((dueTime - nowTime) / 86400000);
                    }

                    // Status counts (based on active matching items)
                    const activeCount = summaryItems.filter(
                      (it) => (it.holdingStatus || "ACTIVE") === "ACTIVE"
                    ).length;
                    const returnedCount = summaryItems.filter(
                      (it) => it.holdingStatus === "RETURNED"
                    ).length;
                    const serviceCount = summaryItems.filter(
                      (it) => it.holdingStatus === "UNDER_SERVICE"
                    ).length;
                    const inactiveCount = summaryItems.filter(
                      (it) => it.holdingStatus === "INACTIVE"
                    ).length;
                    const damagedCount = summaryItems.filter(
                      (it) => it.holdingStatus === "DAMAGED"
                    ).length;
                    const allReturned =
                      returnedCount === summaryItems.length && summaryItems.length > 0;
                    const allActive = activeCount === summaryItems.length;

                    const isGroupIssue = issue.items.length > 1;

                    // Items to display in the expanded table:
                    const displayedItems = showAllInThisIssue ? issue.items : matchingItems;

                    return (
                      <Fragment key={issue._id}>
                        <tr
                          className={`hover:bg-slate-50/80 transition cursor-pointer select-none ${
                            isExpanded ? "bg-blue-50/30 font-medium" : ""
                          }`}
                          onClick={() => toggleExpandIssue(issue._id)}
                        >
                          {/* Issue # & Date */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandIssue(issue._id);
                                }}
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 transition shrink-0 shadow-2xs"
                                title={isExpanded ? "Collapse product list" : "Expand product list"}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5 text-blue-600" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <div>
                                <p className="font-bold text-slate-800 font-mono">
                                  {issue.issueNumber}
                                </p>
                                <span className="text-[11px] text-slate-400">{issuedDate}</span>
                              </div>
                            </div>
                          </td>

                          {/* Employee (Holder) */}
                          <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 shrink-0">
                                {issue.employeeName ? issue.employeeName.slice(0, 1).toUpperCase() : "E"}
                              </div>
                              <div className="min-w-0">
                                <Link
                                  href={`/employee-issues/employee/${encodeURIComponent(
                                    issue.employeeId || issue.employeeName
                                  )}`}
                                  prefetch={true}
                                  className="font-bold text-slate-800 hover:text-blue-600 hover:underline transition inline-flex items-center gap-1 group text-xs truncate max-w-[180px]"
                                  title="Click to view employee custody profile & history"
                                >
                                  <span className="truncate">{issue.employeeName}</span>
                                  <ExternalLink className="h-2.5 w-2.5 text-blue-600 opacity-0 group-hover:opacity-100 transition shrink-0" />
                                </Link>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {issue.employeeDepartment || "General"}
                                  {issue.employeePhone ? ` • ${issue.employeePhone}` : ""}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Products & Quantity (with Smart Filtering indicators) */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isSubFiltered ? (
                                <>
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                                      issueTypeFilter === "REUSABLE"
                                        ? "bg-indigo-50 border border-indigo-200 text-indigo-700"
                                        : "bg-blue-50 border border-blue-200 text-blue-700"
                                    }`}
                                  >
                                    <Layers className="h-3.5 w-3.5" />
                                    {matchingItems.length} of {issue.items.length} Products ({totalSummaryUnits} units)
                                  </span>
                                  <span
                                    className={`inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-bold ${
                                      issueTypeFilter === "REUSABLE"
                                        ? "bg-indigo-100 text-indigo-800"
                                        : issueTypeFilter === "NON_REUSABLE"
                                        ? "bg-slate-200 text-slate-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {issueTypeFilter === "REUSABLE"
                                      ? "Returnable Filtered"
                                      : issueTypeFilter === "NON_REUSABLE"
                                      ? "Non-Returnable Filtered"
                                      : "Filtered"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                                      isGroupIssue
                                        ? "bg-purple-50 border border-purple-200 text-purple-700"
                                        : "bg-blue-50 border border-blue-200 text-blue-700"
                                    }`}
                                  >
                                    <Layers className="h-3.5 w-3.5" />
                                    {issue.items.length}{" "}
                                    {issue.items.length === 1 ? "Product" : "Products"} ({totalVoucherUnits}{" "}
                                    {totalVoucherUnits === 1 ? "unit" : "units"})
                                  </span>
                                  {isGroupIssue ? (
                                    <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                      Group Batch
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                      Single Issue
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            <p
                              className="text-[11px] text-slate-500 mt-1 truncate max-w-xs"
                              title={summaryItems.map((it) => it.productName).join(", ")}
                            >
                              {summaryItems.map((it) => it.productName).slice(0, 2).join(", ")}
                              {summaryItems.length > 2 && ` +${summaryItems.length - 2} more`}
                            </p>
                          </td>

                          {/* Custody Status */}
                          <td className="px-5 py-3.5 text-center">
                            {allReturned ? (
                              <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                RETURNED
                              </span>
                            ) : allActive ? (
                              <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ACTIVE
                              </span>
                            ) : (
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                {activeCount > 0 && (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Active ({activeCount})
                                  </span>
                                )}
                                {returnedCount > 0 && (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    Returned ({returnedCount})
                                  </span>
                                )}
                                {serviceCount > 0 && (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Service ({serviceCount})
                                  </span>
                                )}
                                {damagedCount > 0 && (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                    Damaged ({damagedCount})
                                  </span>
                                )}
                                {inactiveCount > 0 && (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    Inactive ({inactiveCount})
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Return / Renew Due Column */}
                          <td className="px-5 py-3.5">
                            {allReturned ? (
                              <span className="text-slate-400 text-xs">All Items Returned</span>
                            ) : earliestReturnItem && earliestReturnItem.returnDueDate ? (
                              <div>
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-xs text-slate-800">
                                    {new Date(earliestReturnItem.returnDueDate).toLocaleDateString(
                                      "en-IN",
                                      {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      }
                                    )}
                                  </span>
                                  {activeReturnables.length > 1 && (
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      ({activeReturnables.length} due)
                                    </span>
                                  )}
                                </div>
                                {returnDaysLeft !== null && (
                                  <span
                                    className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-extrabold mt-0.5 ${
                                      returnDaysLeft < 0
                                        ? "bg-red-100 text-red-700"
                                        : returnDaysLeft === 0
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-emerald-50 text-emerald-700"
                                    }`}
                                  >
                                    {returnDaysLeft < 0
                                      ? `Overdue by ${Math.abs(returnDaysLeft)}d`
                                      : returnDaysLeft === 0
                                      ? "Due Today"
                                      : `${returnDaysLeft}d remaining`}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">Standard Items</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td
                            className="px-5 py-3.5 text-center print:hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleExpandIssue(issue._id)}
                                className={`flex h-8 items-center gap-1 px-2.5 rounded-lg border text-xs font-semibold transition shadow-2xs active:scale-95 ${
                                  isExpanded
                                    ? "border-blue-300 bg-blue-50 text-blue-700"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                                title={
                                  isExpanded ? "Collapse product list" : "View all product details"
                                }
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                                <span>{isExpanded ? "Hide" : "Details"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openBill(issue)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 transition shadow-2xs active:scale-95"
                                title="View Bill / Issue Voucher"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* 🔽 Expandable Detailed Products Sub-Table for Grouped Items */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={6} className="px-4 py-4 md:px-6">
                              <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                                <div className="bg-gradient-to-r from-slate-100 via-blue-50/40 to-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Layers className="h-4 w-4 text-blue-600" />
                                    <span className="text-xs font-bold text-slate-800">
                                      Voucher #{issue.issueNumber}:
                                    </span>
                                    {isSubFiltered && !showAllInThisIssue ? (
                                      <span className="text-xs font-semibold text-indigo-700">
                                        Showing {matchingItems.length} matching products ({totalSummaryUnits} units) of {issue.items.length} total
                                      </span>
                                    ) : (
                                      <span className="text-xs font-semibold text-slate-700">
                                        All {issue.items.length} products ({totalVoucherUnits} units)
                                      </span>
                                    )}

                                    {/* Toggle to peek all items if filtered */}
                                    {isSubFiltered && (
                                      <button
                                        type="button"
                                        onClick={() => toggleShowAllInIssue(issue._id)}
                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline ml-1"
                                      >
                                        {showAllInThisIssue
                                          ? "Filter to Matching Only"
                                          : `Show All (${issue.items.length})`}
                                      </button>
                                    )}

                                    {isGroupIssue && (
                                      <span className="rounded bg-purple-100 text-purple-800 px-1.5 py-0.2 text-[10px] font-extrabold uppercase">
                                        Group Batch
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                    {issue.reason && (
                                      <span>
                                        Reason:{" "}
                                        <b className="text-slate-700">
                                          {reasonLabels[issue.reason] || issue.reason}
                                        </b>
                                      </span>
                                    )}
                                    {issue.siteName && (
                                      <span>
                                        Site: <b className="text-slate-700">{issue.siteName}</b>
                                      </span>
                                    )}
                                    {issue.issuedByName && (
                                      <span>
                                        Issued By:{" "}
                                        <b className="text-slate-700">{issue.issuedByName}</b>
                                      </span>
                                    )}
                                    {issue.notes && (
                                      <span className="italic text-slate-600">
                                        Note: &ldquo;{issue.notes}&rdquo;
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                                      <tr>
                                        <th className="px-3 py-2 text-center w-10">#</th>
                                        <th className="px-4 py-2">Product Name & SKU</th>
                                        <th className="px-3 py-2">Warehouse / Rack</th>
                                        <th className="px-3 py-2 text-center">Qty & Price</th>
                                        <th className="px-3 py-2">Serial / Tag</th>
                                        <th className="px-3 py-2">Classification & Due</th>
                                        <th className="px-3 py-2 text-center">Status</th>
                                        <th className="px-3 py-2 text-center print:hidden">
                                          Manage
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {displayedItems.map((item, itemIdx) => {
                                        // Original index inside the issue
                                        const originalIndex = issue.items.indexOf(item);
                                        const actualIndex =
                                          originalIndex >= 0 ? originalIndex : itemIdx;

                                        // Is this item matching the filter when showAllInThisIssue is on?
                                        const isMatching = matchingItems.includes(item);

                                        const isReusable =
                                          item.productType === "REUSABLE" ||
                                          Boolean(item.returnDueDate);
                                        let itemDaysLeft: number | null = null;
                                        if (isReusable && item.returnDueDate) {
                                          const dueTime = new Date(item.returnDueDate).setHours(
                                            0,
                                            0,
                                            0,
                                            0
                                          );
                                          const nowTime = new Date().setHours(0, 0, 0, 0);
                                          itemDaysLeft = Math.round(
                                            (dueTime - nowTime) / 86400000
                                          );
                                        }

                                        return (
                                          <tr
                                            key={`${issue._id}-item-${actualIndex}`}
                                            className={`transition ${
                                              showAllInThisIssue && !isMatching
                                                ? "opacity-50 bg-slate-50/40"
                                                : "hover:bg-slate-50/60"
                                            }`}
                                          >
                                            <td className="px-3 py-2.5 text-center text-slate-400 font-bold text-[11px]">
                                              {itemIdx + 1}
                                            </td>
                                            <td className="px-4 py-2.5">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <Link
                                                  href={`/product-history/${encodeURIComponent(
                                                    item.productId?.toString() || item.sku
                                                  )}`}
                                                  className="font-bold text-slate-800 hover:text-blue-600 hover:underline transition inline-flex items-center gap-1 group"
                                                  title="View product history"
                                                >
                                                  <span>{item.productName}</span>
                                                  <ExternalLink className="h-2.5 w-2.5 text-blue-600 opacity-0 group-hover:opacity-100 transition" />
                                                </Link>
                                                {showAllInThisIssue && !isMatching && (
                                                  <span className="rounded bg-slate-200 px-1 text-[9px] font-bold text-slate-600">
                                                    Filtered out
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-[10px] text-slate-400">
                                                SKU: {item.sku}
                                              </p>
                                            </td>
                                            <td className="px-3 py-2.5">
                                              <span className="font-medium text-slate-700">
                                                {item.warehouseName || "-"}
                                              </span>
                                              {item.rackName && (
                                                <span className="text-[10px] text-slate-400 block">
                                                  {item.rackName}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                              <span className="font-bold text-slate-800">
                                                {item.quantity} units
                                              </span>
                                              {item.unitPrice > 0 && (
                                                <span className="text-[10px] text-slate-400 block">
                                                  ₹{item.unitPrice.toLocaleString("en-IN")}/ea
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                              {item.serialNumber ? (
                                                <span className="font-mono text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                                  {item.serialNumber}
                                                </span>
                                              ) : (
                                                <span className="text-slate-400 text-[11px]">-</span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                              {isReusable ? (
                                                <div>
                                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
                                                    <RotateCcw className="h-3 w-3" /> Returnable
                                                  </span>
                                                  {item.returnDueDate && (
                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                      Due:{" "}
                                                      {new Date(
                                                        item.returnDueDate
                                                      ).toLocaleDateString("en-IN")}
                                                      {itemDaysLeft !== null && (
                                                        <span
                                                          className={`ml-1 font-bold ${
                                                            itemDaysLeft < 0
                                                              ? "text-red-600"
                                                              : itemDaysLeft <= 7
                                                              ? "text-amber-600"
                                                              : "text-emerald-600"
                                                          }`}
                                                        >
                                                          (
                                                          {itemDaysLeft < 0
                                                            ? `${Math.abs(itemDaysLeft)}d overdue`
                                                            : `${itemDaysLeft}d left`}
                                                          )
                                                        </span>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="text-[11px] text-slate-500">
                                                  Non-Returnable
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                              <span
                                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                  item.holdingStatus === "ACTIVE"
                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                    : item.holdingStatus === "RETURNED"
                                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                    : item.holdingStatus === "UNDER_SERVICE"
                                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                    : "bg-red-50 text-red-700 border border-red-200"
                                                }`}
                                              >
                                                {item.holdingStatus || "ACTIVE"}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center print:hidden">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setActiveModalIssue({
                                                    issueId: issue._id,
                                                    itemIndex: actualIndex,
                                                  })
                                                }
                                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition shadow-2xs active:scale-95"
                                                title="Manage status, service cycle, or return item"
                                              >
                                                <Wrench className="h-3 w-3 text-slate-500" />
                                                <span>Manage</span>
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Information Footer if some items are hidden */}
                                {isSubFiltered && !showAllInThisIssue && (
                                  <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                      <Info className="h-3.5 w-3.5 text-slate-400" />
                                      <span>
                                        {issue.items.length - matchingItems.length}{" "}
                                        {issueTypeFilter === "REUSABLE"
                                          ? "non-returnable"
                                          : issueTypeFilter === "NON_REUSABLE"
                                          ? "returnable"
                                          : "non-matching"}{" "}
                                        {issue.items.length - matchingItems.length === 1 ? "item" : "items"} hidden by active filter.
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleShowAllInIssue(issue._id)}
                                      className="font-bold text-blue-600 hover:underline"
                                    >
                                      Show all {issue.items.length} items
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          {paginatedIssues.length > 0 && (
            <div className="space-y-3 p-4 md:hidden">
              {paginatedIssues.map((issue) => {
                const isExpanded = expandedIssueIds.has(issue._id);
                const matchingItems = getMatchingItems(
                  issue,
                  issueTypeFilter,
                  statusFilter,
                  searchQuery
                );
                const isFilterActive =
                  issueTypeFilter !== "ALL" ||
                  statusFilter !== "ALL" ||
                  searchQuery.trim() !== "";
                const isSubFiltered =
                  isFilterActive && matchingItems.length < issue.items.length;

                const summaryItems = isSubFiltered ? matchingItems : issue.items;
                const totalUnits = summaryItems.reduce(
                  (acc, it) => acc + (it.quantity || 1),
                  0
                );
                const issuedDate = new Date(issue.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                const isGroupIssue = issue.items.length > 1;

                return (
                  <div
                    key={issue._id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm font-mono">
                            {issue.issueNumber}
                          </span>
                          <span className="text-[11px] text-slate-400">{issuedDate}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Holder:{" "}
                          <Link
                            href={`/employee-issues/employee/${encodeURIComponent(
                              issue.employeeId || issue.employeeName
                            )}`}
                            className="font-bold text-blue-600 underline hover:text-blue-800"
                            title="Click to view employee asset history"
                          >
                            {issue.employeeName}
                          </Link>{" "}
                          ({issue.employeeDepartment || "General"})
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openBill(issue)}
                          className="p-1.5 rounded-lg border border-slate-200 text-emerald-600 hover:bg-emerald-50"
                          title="View Bill"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Layers className="h-4 w-4 text-blue-600" />
                        <span className="font-bold text-slate-800">
                          {isSubFiltered ? (
                            <span>
                              {matchingItems.length} of {issue.items.length} Products ({totalUnits} units)
                            </span>
                          ) : (
                            <span>
                              {issue.items.length}{" "}
                              {issue.items.length === 1 ? "Product" : "Products"} ({totalUnits} units)
                            </span>
                          )}
                        </span>
                        {isGroupIssue && !isSubFiltered && (
                          <span className="rounded bg-purple-100 text-purple-800 px-1.5 py-0.2 text-[9px] font-extrabold uppercase">
                            Group
                          </span>
                        )}
                        {isSubFiltered && (
                          <span className="rounded bg-indigo-100 text-indigo-800 px-1.5 py-0.2 text-[9px] font-extrabold uppercase">
                            {issueTypeFilter === "REUSABLE" ? "Returnable" : "Filtered"}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleExpandIssue(issue._id)}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
                      >
                        <span>{isExpanded ? "Hide Details" : "View Details"}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        {matchingItems.map((item, itemIdx) => {
                          const originalIndex = issue.items.indexOf(item);
                          const actualIndex =
                            originalIndex >= 0 ? originalIndex : itemIdx;
                          const isReusable =
                            item.productType === "REUSABLE" || Boolean(item.returnDueDate);

                          return (
                            <div
                              key={`${issue._id}-m-${actualIndex}`}
                              className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-1.5"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <Link
                                    href={`/product-history/${encodeURIComponent(
                                      item.productId?.toString() || item.sku
                                    )}`}
                                    className="font-bold text-slate-800 hover:text-blue-600 underline"
                                  >
                                    {item.productName}
                                  </Link>
                                  <p className="text-[11px] text-slate-400">
                                    SKU: {item.sku}{" "}
                                    {item.serialNumber && `• SN: ${item.serialNumber}`}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    item.holdingStatus === "ACTIVE"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : item.holdingStatus === "RETURNED"
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : item.holdingStatus === "UNDER_SERVICE"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-red-50 text-red-700 border border-red-200"
                                  }`}
                                >
                                  {item.holdingStatus || "ACTIVE"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-600">
                                <span>
                                  Qty: <b>{item.quantity}</b> • {item.warehouseName}
                                </span>
                                {isReusable && (
                                  <span className="text-indigo-700 font-semibold">
                                    Returnable{" "}
                                    {item.returnDueDate
                                      ? `(${new Date(item.returnDueDate).toLocaleDateString(
                                          "en-IN",
                                          { day: "2-digit", month: "short" }
                                        )})`
                                      : ""}
                                  </span>
                                )}
                              </div>
                              <div className="pt-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveModalIssue({
                                      issueId: issue._id,
                                      itemIndex: actualIndex,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                                >
                                  <Wrench className="h-3 w-3" /> Manage / Service
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredIssues.length > 0 && (
            <div className="border-t border-slate-100 p-3 print:hidden">
              <Pagination
                currentPage={page}
                totalItems={filteredIssues.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>
      </div>

      {/* Service & Manage Cycle Modal */}
      {activeModalData && (
        <ServiceCycleModal
          issue={activeModalData.issue}
          itemIndex={activeModalData.itemIndex}
          onClose={() => setActiveModalIssue(null)}
          onUpdated={handleIssueUpdated}
        />
      )}

      {/* Issue Bill Modal */}
      {billIssue && (
        <IssueBillModal
          issue={billIssue}
          onClose={() => setBillIssue(null)}
        />
      )}

      {/* Quick History Modals */}
      {historyProductId && (
        <ProductHistoryModal
          productId={historyProductId}
          onClose={() => setHistoryProductId(null)}
          onSelectEmployee={(emp) => {
            setHistoryProductId(null);
            setHistoryEmployee(emp);
          }}
        />
      )}
      {historyEmployee && (
        <EmployeeHistoryModal
          employeeIdOrName={historyEmployee}
          onClose={() => setHistoryEmployee(null)}
          onSelectProduct={(pId) => {
            setHistoryEmployee(null);
            setHistoryProductId(pId);
          }}
          onViewBill={(issId) => {
            const found = issues.find((i) => i._id === issId);
            if (found) {
              setHistoryEmployee(null);
              openBill(found);
            }
          }}
        />
      )}

      <WarningPopup
        open={warningOpen}
        onClose={() => setWarningOpen(false)}
        message={warningMessage}
      />
    </ProtectedPage>
  );
}
