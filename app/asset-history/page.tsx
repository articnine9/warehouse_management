"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import {
  History,
  Search,
  RotateCcw,
  Wrench,
  PackageCheck,
  Printer,
  ExternalLink,
  Receipt,
  Layers,
  Box,
  Users,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import WarningPopup from "@/app/components/WarningPopup";
import IssueBillModal, { IssueBillData } from "@/app/components/IssueBillModal";
import ProductHistoryModal from "@/app/components/ProductHistoryModal";
import EmployeeHistoryModal from "@/app/components/EmployeeHistoryModal";
import {
  reasonLabels,
  type Employee,
  type EmployeeIssue,
  type SelectedLineItem,
} from "@/app/employee-issues/types";

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

  // Modals
  const [billIssue, setBillIssue] = useState<IssueBillData | null>(null);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [historyEmployee, setHistoryEmployee] = useState<string | null>(null);

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

  // Flatten all line items
  const allRecords = useMemo(() => {
    const list: Array<{
      issue: EmployeeIssue;
      item: SelectedLineItem;
      itemIndex: number;
    }> = [];
    for (const issue of issues) {
      issue.items.forEach((item, itemIndex) => {
        list.push({ issue, item, itemIndex });
      });
    }
    return list;
  }, [issues]);

  // Overall metrics
  const stats = useMemo(() => {
    let totalActive = 0;
    let totalInService = 0;
    let totalReturned = 0;
    let totalReusable = 0;
    let totalOverdue = 0;
    let totalValue = 0;

    const today = new Date().setHours(0, 0, 0, 0);

    for (const { item } of allRecords) {
      const q = item.quantity || 1;
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

    return {
      totalRecords: allRecords.length,
      totalActive,
      totalInService,
      totalReturned,
      totalReusable,
      totalOverdue,
      totalValue,
    };
  }, [allRecords]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return allRecords.filter(({ issue, item }) => {
      // Employee filter
      if (selectedEmployeeId) {
        const matchId = issue.employeeId === selectedEmployeeId;
        const matchName =
          lookupEmployee &&
          issue.employeeName.toLowerCase() === lookupEmployee.name.toLowerCase();
        if (!matchId && !matchName) return false;
      }

      // Status filter
      if (statusFilter !== "ALL") {
        const currentStatus = item.holdingStatus || "ACTIVE";
        if (currentStatus !== statusFilter) return false;
      }

      // Product type filter
      const isReusable = item.productType === "REUSABLE" || Boolean(item.returnDueDate);
      if (issueTypeFilter === "REUSABLE" && !isReusable) return false;
      if (issueTypeFilter === "NON_REUSABLE" && isReusable) return false;

      // Date range filter
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

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchIssue =
          issue.issueNumber.toLowerCase().includes(q) ||
          issue.employeeName.toLowerCase().includes(q) ||
          issue.employeeEmail.toLowerCase().includes(q) ||
          issue.employeePhone?.toLowerCase().includes(q) ||
          issue.employeeDepartment?.toLowerCase().includes(q) ||
          reasonLabels[issue.reason]?.toLowerCase().includes(q) ||
          issue.issuedByName?.toLowerCase().includes(q);

        const matchItem =
          item.productName.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.serialNumber?.toLowerCase().includes(q) ||
          item.warehouseName?.toLowerCase().includes(q) ||
          item.rackName?.toLowerCase().includes(q);

        return matchIssue || matchItem;
      }

      return true;
    });
  }, [
    allRecords,
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
  }, [selectedEmployeeId, statusFilter, issueTypeFilter, searchQuery, dateFrom, dateTo, pageSize]);

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

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
                  Track employee custody lifecycles, asset handovers, recurring service cycles, and return logs.
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
            <p className="text-[10px] text-slate-400 mt-0.5">{stats.totalRecords} total records</p>
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

                {/* Product Type Toggle */}
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setIssueTypeFilter("ALL")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      issueTypeFilter === "ALL"
                        ? "bg-white text-slate-800 shadow-2xs"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    All Types
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueTypeFilter("REUSABLE")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1 ${
                      issueTypeFilter === "REUSABLE"
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <RotateCcw className="h-3 w-3" /> Returnable
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueTypeFilter("NON_REUSABLE")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      issueTypeFilter === "NON_REUSABLE"
                        ? "bg-white text-slate-800 shadow-2xs"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Non-Returnable
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
                </select>
              </div>
            </div>

            {/* Date Range & Clear */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
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
                  className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition ml-auto"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Product & SKU</th>
                  <th className="px-4 py-3">Issue Slip</th>
                  <th className="px-4 py-3">Location & Serial</th>
                  <th className="px-4 py-3">Issued Date</th>
                  <th className="px-4 py-3">Return Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                      <p>Loading asset movement records...</p>
                    </td>
                  </tr>
                ) : paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      No matching asset custody records found.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map(({ issue, item, itemIndex }) => {
                    const isReusable =
                      item.productType === "REUSABLE" || Boolean(item.returnDueDate);
                    const isOverdue =
                      isReusable &&
                      item.returnDueDate &&
                      item.holdingStatus !== "RETURNED" &&
                      new Date(item.returnDueDate) < new Date();

                    return (
                      <tr key={`${issue._id}-${itemIndex}`} className="hover:bg-slate-50/60 transition">
                        {/* Employee */}
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                              {issue.employeeName.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <Link
                                href={`/employee-issues/employee/${encodeURIComponent(
                                  issue.employeeId || issue.employeeName
                                )}`}
                                prefetch={true}
                                className="font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 group"
                                title="View Employee Custody Profile & History"
                              >
                                {issue.employeeName}
                                <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition" />
                              </Link>
                              <div className="text-[10px] text-slate-400">
                                {issue.employeeDepartment || "General"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Product */}
                        <td className="px-4 py-3">
                          <div>
                            {item.productId ? (
                              <Link
                                href={`/product-history/${encodeURIComponent(item.productId.toString())}`}
                                prefetch={true}
                                className="font-bold text-slate-800 hover:text-blue-600 hover:underline inline-flex items-center gap-1 group"
                                title="View Product Lifecycle & Movement History"
                              >
                                {item.productName}
                                <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition text-blue-500" />
                              </Link>
                            ) : (
                              <span className="font-bold text-slate-800">{item.productName}</span>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[10px] text-slate-500">
                                SKU: {item.sku}
                              </span>
                              <span className="text-[10px] font-bold text-slate-700">
                                (Qty: {item.quantity})
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Issue Slip */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openBill(issue)}
                            className="font-mono text-[11px] font-bold text-blue-600 hover:underline"
                            title="View / Print Issue Voucher"
                          >
                            {issue.issueNumber}
                          </button>
                          <div className="text-[10px] text-slate-400">
                            {reasonLabels[issue.reason] || issue.reason}
                          </div>
                        </td>

                        {/* Location & Serial */}
                        <td className="px-4 py-3">
                          <div className="text-slate-700 font-medium">
                            {item.warehouseName} / {item.rackName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            SN: {item.serialNumber || "None"}
                          </div>
                        </td>

                        {/* Issued Date */}
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(issue.createdAt).toLocaleDateString()}
                          <div className="text-[10px] text-slate-400">
                            By {issue.issuedByName}
                          </div>
                        </td>

                        {/* Return Due / Cycle */}
                        <td className="px-4 py-3">
                          {isReusable ? (
                            <div>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isOverdue
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                }`}
                              >
                                <RotateCcw className="h-2.5 w-2.5" />
                                Due: {item.returnDueDate || `${item.returnDueDays || 30}d`}
                              </span>
                              {isOverdue && (
                                <span className="block text-[10px] font-bold text-red-600 mt-0.5">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">Standard Issue</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              item.holdingStatus === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700"
                                : item.holdingStatus === "UNDER_SERVICE"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.holdingStatus || "ACTIVE"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right print:hidden">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openBill(issue)}
                              className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition"
                              title="View Issue Voucher"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filteredRecords.length > 0 && (
            <div className="border-t border-slate-100 p-3 print:hidden">
              <Pagination
                currentPage={page}
                totalItems={filteredRecords.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>
      </div>

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
