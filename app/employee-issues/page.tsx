"use client";

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  PackageCheck,
  Search,
  Trash2,
  X,
  Wrench,
  RotateCcw,
  Eye,
  ExternalLink,
  History,
  Box,
  ChevronDown,
  ChevronUp,
  Layers,
  Info,
} from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import WarningPopup from "@/app/components/WarningPopup";
import IssueBillModal, { IssueBillData } from "@/app/components/IssueBillModal";
import ProductHistoryModal from "@/app/components/ProductHistoryModal";
import EmployeeHistoryModal from "@/app/components/EmployeeHistoryModal";
import AddEmployeeModal from "@/app/components/AddEmployeeModal";
import {
  CUSTOM_INTERVAL_VALUE,
  SERVICE_INTERVAL_OPTIONS,
  formatServiceInterval,
  normalizeIntervalMonths,
  type HoldingStatus,
} from "@/lib/serviceCycle";
import ServiceCycleModal from "./ServiceCycleModal";
import {
  reasonLabels,
  type Employee,
  type EmployeeIssue,
  type InventoryItem,
  type SelectedLineItem,
} from "./types";

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

export default function EmployeeIssuesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [issues, setIssues] = useState<EmployeeIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);

  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemSerial, setItemSerial] = useState("");
  const [itemProductType, setItemProductType] = useState<"NON_REUSABLE" | "REUSABLE">("NON_REUSABLE");
  const [itemReturnDueDays, setItemReturnDueDays] = useState("30");
  const [itemWarrantyMonths, setItemWarrantyMonths] = useState("12");
  const [itemServiceInterval, setItemServiceInterval] = useState("3"); // default 3 months
  const [customInterval, setCustomInterval] = useState("");
  const [itemHoldingStatus, setItemHoldingStatus] = useState<HoldingStatus>("ACTIVE");

  const [lineItems, setLineItems] = useState<SelectedLineItem[]>([]);

  const [reason, setReason] = useState<EmployeeIssue["reason"]>("INSTALLATION_WORK");
  const [siteName, setSiteName] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedLookupEmployeeId, setSelectedLookupEmployeeId] = useState("");
  const [issueSearchQuery, setIssueSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [issueTypeFilter, setIssueTypeFilter] = useState("ALL");
  const [issueDateFrom, setIssueDateFrom] = useState("");
  const [issueDateTo, setIssueDateTo] = useState("");
  const [issuePage, setIssuePage] = useState(1);
  const [issuePageSize, setIssuePageSize] = useState(10);
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());
  const [showAllInIssueIds, setShowAllInIssueIds] = useState<Set<string>>(new Set());

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

  // Manage / Service Modal State
  const [activeModalIssue, setActiveModalIssue] = useState<{
    issueId: string;
    itemIndex: number;
  } | null>(null);

  // Issue Bill Modal State
  const [billIssue, setBillIssue] = useState<IssueBillData | null>(null);

  // Top-to-Bottom Product & Employee History Modals
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [historyEmployee, setHistoryEmployee] = useState<string | null>(null);

  const [deleteIssueId, setDeleteIssueId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  async function fetchInventory() {
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      const result = await response.json();
      if (result.success) {
        setInventoryList(result.data || []);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function fetchIssues() {
    try {
      setLoading(true);
      const response = await fetch("/api/employee-issues", { cache: "no-store" });
      const result = await response.json();
      if (result.success) {
        setIssues(result.data || []);
        setEmployees(result.employees || []);
      }
    } catch (error) {
      console.error("Failed to fetch employee issues:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchInventory();
    void fetchIssues();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(target)) {
        setEmployeeDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(target)) {
        setProductDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);
  const currentSelectedInventory = inventoryList.find((inventory) => inventory._id === selectedInventoryId);
  const availableInventories = inventoryList.filter((inventory) => inventory.quantity > 0);

  const matchingEmployees = useMemo(() => {
    if (!employeeSearchQuery.trim()) return employees;
    const query = employeeSearchQuery.toLowerCase().trim();
    return employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(query) ||
        employee.employeeCode.toLowerCase().includes(query) ||
        employee.phone.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        employee.department.toLowerCase().includes(query) ||
        employee.designation.toLowerCase().includes(query) ||
        employee.warehouse?.name.toLowerCase().includes(query) ||
        employee.warehouse?.code.toLowerCase().includes(query)
    );
  }, [employees, employeeSearchQuery]);

  const matchingInventories = useMemo(() => {
    if (!productSearchQuery.trim()) return availableInventories;
    const query = productSearchQuery.toLowerCase().trim();
    return availableInventories.filter((inventory) => {
      const product = inventory.productId;
      return (
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query) ||
        product.sellerName?.toLowerCase().includes(query) ||
        inventory.warehouseId.name.toLowerCase().includes(query) ||
        inventory.warehouseId.code.toLowerCase().includes(query) ||
        inventory.rackId.name.toLowerCase().includes(query) ||
        inventory.rackId.code.toLowerCase().includes(query)
      );
    });
  }, [availableInventories, productSearchQuery]);

  const lookupEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedLookupEmployeeId) || null;
  }, [employees, selectedLookupEmployeeId]);

  const lookupEmployeeStats = useMemo(() => {
    if (!selectedLookupEmployeeId) return null;
    const empIssues = issues.filter(
      (i) =>
        i.employeeId === selectedLookupEmployeeId ||
        (lookupEmployee && i.employeeName.toLowerCase() === lookupEmployee.name.toLowerCase())
    );
    let totalItemsIssued = 0;
    let totalActiveUnits = 0;
    let totalReturnedUnits = 0;
    let totalValue = 0;
    let reusableDueCount = 0;

    const nowTime = new Date().setHours(0, 0, 0, 0);

    for (const issue of empIssues) {
      for (const it of issue.items) {
        totalItemsIssued += it.quantity || 1;
        if (it.holdingStatus === "RETURNED") {
          totalReturnedUnits += it.quantity || 1;
        } else {
          totalActiveUnits += it.quantity || 1;
          totalValue += (it.unitPrice || 0) * (it.quantity || 1);
          if (it.returnDueDate) {
            const dueTime = new Date(it.returnDueDate).setHours(0, 0, 0, 0);
            const daysRemaining = Math.round((dueTime - nowTime) / 86400000);
            if (daysRemaining <= 7) {
              reusableDueCount++;
            }
          }
        }
      }
    }

    return {
      totalIssues: empIssues.length,
      totalItemsIssued,
      totalActiveUnits,
      totalReturnedUnits,
      totalValue,
      reusableDueCount,
    };
  }, [issues, selectedLookupEmployeeId, lookupEmployee]);

  // Filter issues: includes any issue that has at least 1 matching item under active filters
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // 1. Employee Lookup Filter
      if (selectedLookupEmployeeId) {
        const matchId = issue.employeeId === selectedLookupEmployeeId;
        const matchName =
          lookupEmployee &&
          issue.employeeName.toLowerCase() === lookupEmployee.name.toLowerCase();
        if (!matchId && !matchName) return false;
      }

      // 2. Date Range Filter
      if (issueDateFrom) {
        const d = new Date(issue.createdAt);
        if (d < new Date(issueDateFrom)) return false;
      }
      if (issueDateTo) {
        const end = new Date(issueDateTo);
        end.setHours(23, 59, 59, 999);
        const d = new Date(issue.createdAt);
        if (d > end) return false;
      }

      // 3. Matching Items check (Smart filtering by Returnable / Non-Returnable / Status / Search)
      const matching = getMatchingItems(
        issue,
        issueTypeFilter,
        statusFilter,
        issueSearchQuery
      );
      return matching.length > 0;
    });
  }, [
    issues,
    selectedLookupEmployeeId,
    lookupEmployee,
    statusFilter,
    issueTypeFilter,
    issueDateFrom,
    issueDateTo,
    issueSearchQuery,
  ]);

  // Reset pagination to Page 1 when any filter changes
  useEffect(() => {
    setIssuePage(1);
  }, [
    selectedLookupEmployeeId,
    statusFilter,
    issueTypeFilter,
    issueSearchQuery,
    issueDateFrom,
    issueDateTo,
    issuePageSize,
  ]);

  const paginatedIssues = useMemo(() => {
    const start = (issuePage - 1) * issuePageSize;
    return filteredIssues.slice(start, start + issuePageSize);
  }, [filteredIssues, issuePage, issuePageSize]);

  function expandAll() {
    setExpandedIssueIds(new Set(filteredIssues.map((i) => i._id)));
  }

  function collapseAll() {
    setExpandedIssueIds(new Set());
  }

  // Resolved from the live list so the modal always shows the latest saved values.
  const activeModalData = useMemo(() => {
    if (!activeModalIssue) return null;
    const issue = issues.find((item) => item._id === activeModalIssue.issueId);
    if (!issue || !issue.items[activeModalIssue.itemIndex]) return null;
    return { issue, itemIndex: activeModalIssue.itemIndex };
  }, [activeModalIssue, issues]);

  function handleSelectEmployee(employee: Employee) {
    setSelectedEmployeeId(employee.id);
    setEmployeeSearchQuery(`${employee.employeeCode} - ${employee.name}`);
    setEmployeeDropdownOpen(false);
  }

  function handleClearEmployee() {
    setSelectedEmployeeId("");
    setEmployeeSearchQuery("");
    setEmployeeDropdownOpen(true);
  }

  function handleSelectInventory(inventory: InventoryItem) {
    setSelectedInventoryId(inventory._id);
    setProductSearchQuery(`${inventory.productId.name} (${inventory.productId.sku})`);
    setProductDropdownOpen(false);
    setItemQuantity("1");
    const isReusable = inventory.productId.productType === "REUSABLE";
    setItemProductType(isReusable ? "REUSABLE" : "NON_REUSABLE");
    setItemReturnDueDays(inventory.productId.returnDays?.toString() || "30");

    // Auto-populate service interval, warranty, and serial from Product definition
    const productInterval = inventory.productId.serviceIntervalMonths ?? 3;
    const isPreset = [1, 3, 6, 12, 0].includes(productInterval);
    setItemServiceInterval(isPreset ? String(productInterval) : CUSTOM_INTERVAL_VALUE);
    setCustomInterval(isPreset ? "" : String(productInterval));

    setItemWarrantyMonths(inventory.productId.warrantyMonths !== undefined ? String(inventory.productId.warrantyMonths) : "12");
    setItemSerial(inventory.productId.serialNumber || "");

    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 50);
  }

  function handleClearProduct() {
    setSelectedInventoryId("");
    setProductSearchQuery("");
    setProductDropdownOpen(true);
  }

  function updateItemServiceInterval(value: string) {
    setItemServiceInterval(value);
  }

  function updateCustomInterval(value: string) {
    setCustomInterval(value);
  }

  function handleAddLineItem() {
    if (!currentSelectedInventory) {
      setWarningMessage("Please select a product from inventory");
      setWarningOpen(true);
      return;
    }

    const quantity = Number(itemQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setWarningMessage("Please enter a valid quantity");
      setWarningOpen(true);
      return;
    }

    const alreadyAddedQuantity = lineItems
      .filter((item) => item.inventoryId === currentSelectedInventory._id)
      .reduce((sum, item) => sum + item.quantity, 0);
    const remainingStock = currentSelectedInventory.quantity - alreadyAddedQuantity;

    if (quantity > remainingStock) {
      setWarningMessage(`Requested quantity exceeds remaining stock (${Math.max(0, remainingStock)})`);
      setWarningOpen(true);
      return;
    }

    const unitPrice = Number(currentSelectedInventory.productId.price) || 0;
    const warrantyMonths = Number(itemWarrantyMonths) || 0;
    const intervalMonths = normalizeIntervalMonths(
      itemServiceInterval === CUSTOM_INTERVAL_VALUE ? customInterval : itemServiceInterval
    );

    const startDate = new Date();
    let endDate: string | undefined = undefined;
    if (warrantyMonths > 0) {
      const ed = new Date(startDate);
      ed.setMonth(ed.getMonth() + warrantyMonths);
      endDate = ed.toISOString().slice(0, 10);
    }

    const isReusable = itemProductType === "REUSABLE";
    const returnDueDays = isReusable ? Math.max(1, Number(itemReturnDueDays) || 30) : 0;
    const returnDueDate = isReusable
      ? new Date(Date.now() + returnDueDays * 86400000).toISOString().slice(0, 10)
      : undefined;

    const newItem: SelectedLineItem = {
      inventoryId: currentSelectedInventory._id,
      productName: currentSelectedInventory.productId.name,
      sku: currentSelectedInventory.productId.sku,
      productType: isReusable ? "REUSABLE" : "NON_REUSABLE",
      returnDueDays,
      returnDueDate,
      renewalCount: 0,
      renewalHistory: [],
      warehouseName: currentSelectedInventory.warehouseId.name,
      rackName: currentSelectedInventory.rackId.name,
      unitPrice,
      maxStock: currentSelectedInventory.quantity,
      quantity,
      totalValue: unitPrice * quantity,
      serialNumber: itemSerial.trim() || undefined,
      warrantyMonths,
      warrantyStartDate: startDate.toISOString().slice(0, 10),
      warrantyEndDate: endDate,
      serviceIntervalMonths: intervalMonths,
      serviceCount: 0,
      serviceHistory: [],
      holdingStatus: itemHoldingStatus,
    };

    setLineItems((prev) => [...prev, newItem]);
    setSelectedInventoryId("");
    setProductSearchQuery("");
    setItemQuantity("1");
    setItemSerial("");
  }

  function handleRemoveLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSubmitIssue(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedEmployeeId) {
      setWarningMessage("Please select a user");
      setWarningOpen(true);
      return;
    }
    if (lineItems.length === 0) {
      setWarningMessage("Please add at least one product to issue");
      setWarningOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/employee-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          reason,
          siteName,
          notes,
          items: lineItems,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to issue products");
        setWarningOpen(true);
        return;
      }

      // Reset
      setSelectedEmployeeId("");
      setEmployeeSearchQuery("");
      setLineItems([]);
      setNotes("");
      setReason("INSTALLATION_WORK");
      setSiteName("");
      await fetchIssues();
      await fetchInventory();
    } catch (error) {
      console.error("Failed to create issue:", error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setSubmitting(false);
    }
  }

  function openServiceModal(issue: EmployeeIssue, itemIndex: number) {
    if (!issue.items[itemIndex]) return;
    setActiveModalIssue({ issueId: issue._id, itemIndex });
  }

  /** Applies the saved record returned by the API so the table reflects it instantly. */
  function handleIssueUpdated(updatedIssue: EmployeeIssue) {
    setIssues((prev) =>
      prev.map((issue) => (issue._id === updatedIssue._id ? updatedIssue : issue))
    );
    void fetchInventory();
  }

  async function handleDeleteIssue() {
    if (!deleteIssueId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/employee-issues/${deleteIssueId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDeleteIssueId(null);
        await fetchIssues();
        await fetchInventory();
      } else {
        setWarningMessage(data.message || "Failed to delete issue record");
        setWarningOpen(true);
      }
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
              User Asset Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Issue products to users, configure service interval cycles, and manage custody handovers.
            </p>
          </div>
          <div>
            <Link
              href="/asset-history"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-600 transition"
            >
              <History className="h-4 w-4 text-blue-600" />
              View Asset Movement & History Directory →
            </Link>
          </div>
        </div>

        {/* Issue Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <PackageCheck className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-800">Issue Product to User</h2>
          </div>

          <form onSubmit={handleSubmitIssue} className="space-y-4">
            {/* User Selection */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div ref={employeeDropdownRef} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600 uppercase">
                    Select User *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddEmployeeOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    + Add New User
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type user name, code, department..."
                    value={employeeSearchQuery}
                    onChange={(e) => {
                      setEmployeeSearchQuery(e.target.value);
                      setSelectedEmployeeId("");
                      setEmployeeDropdownOpen(true);
                    }}
                    onFocus={() => setEmployeeDropdownOpen(true)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  {selectedEmployeeId && (
                    <button
                      type="button"
                      onClick={handleClearEmployee}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {employeeDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    {matchingEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        onClick={() => handleSelectEmployee(emp)}
                        className="cursor-pointer rounded-lg p-2.5 transition hover:bg-blue-50"
                      >
                        <p className="font-semibold text-slate-800 text-sm">
                          {emp.employeeCode} - {emp.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {emp.department} • {emp.designation} {emp.phone && `• ${emp.phone}`}
                        </p>
                      </div>
                    ))}
                    {matchingEmployees.length === 0 && (
                      <p className="p-3 text-center text-xs text-slate-400">No employees found.</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Reason for Use
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as EmployeeIssue["reason"])}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="INSTALLATION_WORK">Installation Work</option>
                  <option value="MAINTENANCE_AMC">Maintenance / AMC</option>
                  <option value="EQUIPMENT_REPLACEMENT">Equipment Replacement</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Site Name
                </label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="Enter site name"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Product & Recurring Service Details */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase">
                <Wrench className="h-3.5 w-3.5 text-blue-600" />
                <span>Product & Service Interval Setting</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Product Search */}
                <div ref={productDropdownRef} className="relative sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Select Stock Product *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type product name, SKU, rack..."
                      value={productSearchQuery}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value);
                        setSelectedInventoryId("");
                        setProductDropdownOpen(true);
                      }}
                      onFocus={() => setProductDropdownOpen(true)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 pr-10 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                    {selectedInventoryId && (
                      <button
                        type="button"
                        onClick={handleClearProduct}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {productDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      {matchingInventories.map((inv) => (
                        <div
                          key={inv._id}
                          onClick={() => handleSelectInventory(inv)}
                          className="cursor-pointer rounded-lg p-2 transition hover:bg-blue-50 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{inv.productId.name}</span>
                            <span className="font-bold text-blue-600">{inv.quantity} in stock</span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            SKU: {inv.productId.sku} • Rack: {inv.rackId.name} • WH: {inv.warehouseId.code}
                          </p>
                        </div>
                      ))}
                      {matchingInventories.length === 0 && (
                        <p className="p-3 text-center text-xs text-slate-400">No stock products found.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Quantity *
                  </label>
                  <input
                    ref={quantityInputRef}
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>

                {/* Serial Number */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Serial No / Asset Tag (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SN-882319"
                    value={itemSerial}
                    onChange={(e) => setItemSerial(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Product Classification & Return Period */}
              {currentSelectedInventory && (
                <div
                  className={`rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border transition ${
                    itemProductType === "REUSABLE"
                      ? "bg-indigo-50/70 border-indigo-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Issue Type:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setItemProductType("REUSABLE")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition select-none ${
                          itemProductType === "REUSABLE"
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Returnable Asset
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemProductType("NON_REUSABLE")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition select-none ${
                          itemProductType === "NON_REUSABLE"
                            ? "bg-slate-700 text-white border-slate-700 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <Box className="h-3.5 w-3.5" />
                        Non-Returnable
                      </button>
                    </div>
                  </div>

                  {itemProductType === "REUSABLE" ? (
                    <div className="flex items-center gap-2 flex-wrap pt-1 sm:pt-0">
                      <label className="text-[11px] font-bold text-indigo-950">Return Within:</label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={itemReturnDueDays}
                        onChange={(e) => setItemReturnDueDays(e.target.value)}
                        className="w-20 rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
                      />
                      <span className="text-xs text-indigo-900 font-medium">Days</span>
                      <div className="flex gap-1">
                        {[7, 14, 30, 60, 90].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setItemReturnDueDays(d.toString())}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                              itemReturnDueDays === d.toString()
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                            }`}
                          >
                            {d}d
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">
                      Consumable / Normal issue (No return required)
                    </span>
                  )}
                </div>
              )}

              {/* Initial Status */}
              <div className="pt-1 max-w-xs">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Initial Status
                </label>
                <select
                  value={itemHoldingStatus}
                  onChange={(e) => setItemHoldingStatus(e.target.value as HoldingStatus)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 font-medium text-slate-800"
                >
                  <option value="ACTIVE">ACTIVE (In Active Use / Working)</option>
                  <option value="INACTIVE">INACTIVE (Not Working / Idle)</option>
                  <option value="UNDER_SERVICE">UNDER SERVICE (In Repair)</option>
                </select>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98]"
                >
                  + Add Item to Issue List
                </button>
              </div>
            </div>

            {/* Added Line Items Table */}
            {lineItems.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Product & SKU</th>
                      <th className="px-4 py-2.5">Type & Return Due</th>
                      <th className="px-4 py-2.5">Serial No</th>
                      <th className="px-4 py-2.5">Qty</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {lineItems.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {item.productName}
                          <span className="block text-[10px] text-slate-400">SKU: {item.sku}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {item.productType === "REUSABLE" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                              <RotateCcw className="h-2.5 w-2.5" /> Returnable ({item.returnDueDays || 30}d)
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                              Non-Returnable
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{item.serialNumber || "-"}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-800">{item.quantity}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              item.holdingStatus === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700"
                                : item.holdingStatus === "INACTIVE"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {item.holdingStatus}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(index)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Notes & Submit */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
              <input
                type="text"
                placeholder="Optional notes / issue remarks..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={submitting || lineItems.length === 0}
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Processing..." : `Complete Issue (${lineItems.length} Products)`}
              </button>
            </div>
          </form>
        </div>

        {/* Issued Products & Custody History Directory */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 p-4 md:p-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Asset Movement & Custody History ({filteredIssues.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitor products held by employees, returnable return/renewal periods, recurring service cycles, and custody status.
              </p>
            </div>
          </div>

          {/* Filter Bar matching Asset History layout */}
          <div className="border-b border-slate-100 p-4 md:p-5 space-y-3.5 print:hidden bg-slate-50/40">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search employee, product, SKU, serial no, issue #..."
                  value={issueSearchQuery}
                  onChange={(e) => setIssueSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2 text-xs font-medium outline-none focus:border-blue-500 transition"
                />
                {issueSearchQuery && (
                  <button
                    onClick={() => setIssueSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Employee Filter */}
                <select
                  value={selectedLookupEmployeeId}
                  onChange={(e) => setSelectedLookupEmployeeId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="">All Users ({employees.length})</option>
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
                  <option value="ACTIVE">ACTIVE (In Use)</option>
                  <option value="INACTIVE">INACTIVE (Idle / Faulty)</option>
                  <option value="UNDER_SERVICE">UNDER SERVICE</option>
                  <option value="RETURNED">RETURNED</option>
                  <option value="DAMAGED">DAMAGED</option>
                </select>
              </div>
            </div>

            {/* Date Range, Expand/Collapse & Reset Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Date Range:</span>
                <input
                  type="date"
                  value={issueDateFrom}
                  onChange={(e) => setIssueDateFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
                  title="Filter from issue date"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={issueDateTo}
                  onChange={(e) => setIssueDateTo(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
                  title="Filter to issue date"
                />

                {(selectedLookupEmployeeId ||
                  statusFilter !== "ALL" ||
                  issueTypeFilter !== "ALL" ||
                  issueSearchQuery ||
                  issueDateFrom ||
                  issueDateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLookupEmployeeId("");
                      setStatusFilter("ALL");
                      setIssueTypeFilter("ALL");
                      setIssueSearchQuery("");
                      setIssueDateFrom("");
                      setIssueDateTo("");
                    }}
                    className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                    title="Clear all active filters"
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

          {/* Employee Asset Custody & Profile Summary Banner */}
          {lookupEmployee && lookupEmployeeStats && (
            <div className="m-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-xs">
                    {lookupEmployee.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-base">{lookupEmployee.name}</h3>
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                        {lookupEmployee.employeeCode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                      <span>Dept: <b>{lookupEmployee.department || "General"}</b></span>
                      {lookupEmployee.designation && <span>• Desig: <b>{lookupEmployee.designation}</b></span>}
                      {lookupEmployee.phone && <span>• Phone: <b>{lookupEmployee.phone}</b></span>}
                      {lookupEmployee.email && <span>• Email: <b>{lookupEmployee.email}</b></span>}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLookupEmployeeId("")}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition self-start sm:self-auto flex items-center gap-1 shadow-2xs"
                >
                  <X className="h-3.5 w-3.5" /> Clear Employee Filter
                </button>
              </div>

              {/* Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-lg bg-white p-2.5 border border-slate-100 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Active In Custody</span>
                  <span className="font-bold text-emerald-700 text-base">{lookupEmployeeStats.totalActiveUnits} units</span>
                </div>
                <div className="rounded-lg bg-white p-2.5 border border-slate-100 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Returned to Stock</span>
                  <span className="font-bold text-slate-700 text-base">{lookupEmployeeStats.totalReturnedUnits} units</span>
                </div>
                <div className="rounded-lg bg-white p-2.5 border border-slate-100 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Return / Renew Due</span>
                  <span className={`font-bold text-base ${lookupEmployeeStats.reusableDueCount > 0 ? "text-amber-600" : "text-slate-700"}`}>
                    {lookupEmployeeStats.reusableDueCount} items
                  </span>
                </div>
                <div className="rounded-lg bg-white p-2.5 border border-slate-100 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Held Asset Value</span>
                  <span className="font-bold text-blue-700 text-base">₹{lookupEmployeeStats.totalValue.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Table */}
          {paginatedIssues.length > 0 && (
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Issue # & Date</th>
                    <th className="px-5 py-3">Employee (Holder)</th>
                    <th className="px-5 py-3">Products & Quantity</th>
                    <th className="px-5 py-3 text-center">Custody Status</th>
                    <th className="px-5 py-3">Return / Renew Due</th>
                    <th className="px-5 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedIssues.map((issue) => {
                    const isExpanded = expandedIssueIds.has(issue._id);
                    const showAllInThisIssue = showAllInIssueIds.has(issue._id);

                    // Smart Item Filtering
                    const matchingItems = getMatchingItems(
                      issue,
                      issueTypeFilter,
                      statusFilter,
                      issueSearchQuery
                    );

                    const isFilterActive =
                      issueTypeFilter !== "ALL" ||
                      statusFilter !== "ALL" ||
                      issueSearchQuery.trim() !== "";
                    const isSubFiltered =
                      isFilterActive && matchingItems.length < issue.items.length;

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

                    // Return due date calculation (on summaryItems)
                    const activeReturnables = summaryItems.filter(
                      (it) =>
                        (it.productType === "REUSABLE" || Boolean(it.returnDueDate)) &&
                        it.holdingStatus !== "RETURNED" &&
                        it.returnDueDate
                    );

                    let earliestReturnItem: (typeof issue.items)[0] | null = null;
                    let returnDaysLeft: number | null = null;
                    if (activeReturnables.length > 0) {
                      const sorted = [...activeReturnables].sort(
                        (a, b) =>
                          new Date(a.returnDueDate!).getTime() -
                          new Date(b.returnDueDate!).getTime()
                      );
                      earliestReturnItem = sorted[0];
                      const dueTime = new Date(earliestReturnItem.returnDueDate!).setHours(0, 0, 0, 0);
                      const nowTime = new Date().setHours(0, 0, 0, 0);
                      returnDaysLeft = Math.round((dueTime - nowTime) / 86400000);
                    }

                    // Status counts (on summaryItems)
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
                    const allReturned = returnedCount === summaryItems.length && summaryItems.length > 0;
                    const allActive = activeCount === summaryItems.length;

                    const isGroupIssue = issue.items.length > 1;
                    const displayedItems = showAllInThisIssue ? issue.items : matchingItems;

                    return (
                      <Fragment key={issue._id}>
                        <tr
                          className={`hover:bg-slate-50/80 transition cursor-pointer select-none ${
                            isExpanded ? "bg-blue-50/30 font-medium" : ""
                          }`}
                          onClick={() => toggleExpandIssue(issue._id)}
                        >
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
                                <p className="font-bold text-slate-800">{issue.issueNumber}</p>
                                <span className="text-[11px] text-slate-400">{issuedDate}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <Link
                              href={`/employee-issues/employee/${encodeURIComponent(
                                issue.employeeId || issue.employeeName
                              )}`}
                              prefetch={true}
                              className="font-semibold text-slate-800 text-left hover:text-blue-600 hover:underline transition flex items-center gap-1 group"
                              title="Click to view complete top-to-bottom employee asset history"
                            >
                              <span>{issue.employeeName}</span>
                              <ExternalLink className="h-2.5 w-2.5 text-blue-600 opacity-0 group-hover:opacity-100 transition" />
                            </Link>
                            <p className="text-[11px] text-slate-400">
                              {issue.employeeDepartment || "-"} • {issue.employeePhone || "-"}
                            </p>
                          </td>
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
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-slate-200 text-slate-800"
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
                                        : returnDaysLeft <= 7
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

                          <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleExpandIssue(issue._id)}
                                className={`flex h-8 items-center gap-1 px-2.5 rounded-lg border text-xs font-semibold transition shadow-2xs active:scale-95 ${
                                  isExpanded
                                    ? "border-blue-300 bg-blue-50 text-blue-700"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                                title={isExpanded ? "Collapse product list" : "View all products"}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                                <span>{isExpanded ? "Close" : "Details"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openBill(issue)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 transition shadow-2xs active:scale-95"
                                title="View Bill / Issue Voucher"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteIssueId(issue._id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-red-500 hover:bg-red-50 hover:text-red-700 transition shadow-2xs active:scale-95"
                                title="Delete this issue record"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* 🔽 Expandable Detailed Products Sub-Table */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                                <div className="bg-gradient-to-r from-slate-100 via-blue-50/40 to-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-blue-600" />
                                    <span className="text-xs font-bold text-slate-800">
                                      Products in Voucher #{issue.issueNumber} ({issue.items.length}{" "}
                                      items • {totalVoucherUnits} total units)
                                    </span>
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
                                        <th className="px-3 py-2 text-center">Manage</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {displayedItems.map((item, itemIdx) => {
                                        const originalIndex = issue.items.indexOf(item);
                                        const actualIndex =
                                          originalIndex >= 0 ? originalIndex : itemIdx;
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
                                          itemDaysLeft = Math.round((dueTime - nowTime) / 86400000);
                                        }

                                        return (
                                          <tr
                                            key={`${issue._id}-item-${actualIndex}`}
                                            className="hover:bg-slate-50/60 transition"
                                          >
                                            <td className="px-3 py-2.5 text-center text-slate-400 font-bold text-[11px]">
                                              {itemIdx + 1}
                                            </td>
                                            <td className="px-4 py-2.5">
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
                                                  Rack: {item.rackName}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                              <span className="font-bold text-blue-600">
                                                {item.quantity} units
                                              </span>
                                              {item.unitPrice ? (
                                                <span className="text-[10px] text-slate-400 block">
                                                  ₹{item.unitPrice.toLocaleString("en-IN")}
                                                </span>
                                              ) : null}
                                            </td>
                                            <td className="px-3 py-2.5">
                                              {item.serialNumber ? (
                                                <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                  {item.serialNumber}
                                                </span>
                                              ) : (
                                                <span className="text-slate-400 text-[11px]">-</span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                              {item.holdingStatus === "RETURNED" ? (
                                                <span className="text-slate-400 text-[11px]">
                                                  Item Returned
                                                </span>
                                              ) : isReusable && item.returnDueDate ? (
                                                <div>
                                                  <div className="flex items-center gap-1">
                                                    <span className="rounded bg-indigo-50 border border-indigo-200 px-1 py-0.2 text-[9px] font-bold text-indigo-700">
                                                      Returnable
                                                    </span>
                                                    <span className="font-semibold text-[11px] text-slate-700">
                                                      {new Date(
                                                        item.returnDueDate
                                                      ).toLocaleDateString("en-IN", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric",
                                                      })}
                                                    </span>
                                                  </div>
                                                  {itemDaysLeft !== null && (
                                                    <span
                                                      className={`inline-block rounded px-1.5 py-0.2 text-[9px] font-extrabold mt-0.5 ${
                                                        itemDaysLeft < 0
                                                          ? "bg-red-100 text-red-700"
                                                          : itemDaysLeft <= 7
                                                          ? "bg-amber-100 text-amber-800"
                                                          : "bg-emerald-50 text-emerald-700"
                                                      }`}
                                                    >
                                                      {itemDaysLeft < 0
                                                        ? `Overdue by ${Math.abs(itemDaysLeft)}d`
                                                        : itemDaysLeft === 0
                                                        ? "Due Today"
                                                        : `${itemDaysLeft}d remaining`}
                                                    </span>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="text-slate-400 text-[11px]">
                                                  Standard Item
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                              <span
                                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                  item.holdingStatus === "ACTIVE"
                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                    : item.holdingStatus === "INACTIVE"
                                                    ? "bg-slate-100 text-slate-600 border border-slate-200"
                                                    : item.holdingStatus === "UNDER_SERVICE"
                                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                    : item.holdingStatus === "RETURNED"
                                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                    : "bg-red-50 text-red-700 border border-red-200"
                                                }`}
                                              >
                                                {item.holdingStatus || "ACTIVE"}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                              <button
                                                type="button"
                                                onClick={() => openServiceModal(issue, actualIndex)}
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
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile Cards */}
          {paginatedIssues.length > 0 && (
            <div className="space-y-3 p-4 md:hidden">
              {paginatedIssues.map((issue) => {
                const isExpanded = expandedIssueIds.has(issue._id);
                const showAllInThisIssue = showAllInIssueIds.has(issue._id);
                const matchingItems = getMatchingItems(
                  issue,
                  issueTypeFilter,
                  statusFilter,
                  issueSearchQuery
                );

                const isFilterActive =
                  issueTypeFilter !== "ALL" ||
                  statusFilter !== "ALL" ||
                  issueSearchQuery.trim() !== "";
                const isSubFiltered =
                  isFilterActive && matchingItems.length < issue.items.length;

                const summaryItems = isSubFiltered ? matchingItems : issue.items;

                const totalSummaryUnits = summaryItems.reduce(
                  (acc, it) => acc + (it.quantity || 1),
                  0
                );
                const totalVoucherUnits = issue.items.reduce(
                  (acc, it) => acc + (it.quantity || 1),
                  0
                );

                const isGroupIssue = issue.items.length > 1;
                const displayedItems = showAllInThisIssue ? issue.items : matchingItems;

                const issuedDate = new Date(issue.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <div
                    key={issue._id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">
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
                          ({issue.employeeDepartment || "-"})
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
                        <button
                          type="button"
                          onClick={() => setDeleteIssueId(issue._id)}
                          className="p-1.5 rounded-lg border border-slate-200 text-red-500 hover:bg-red-50"
                          title="Delete issue"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile summary */}
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Layers className="h-4 w-4 text-blue-600" />
                        <span className="font-bold text-slate-800">
                          {isSubFiltered ? (
                            <span>
                              {matchingItems.length} of {issue.items.length} Products ({totalSummaryUnits} units)
                            </span>
                          ) : (
                            <span>
                              {issue.items.length}{" "}
                              {issue.items.length === 1 ? "Product" : "Products"} ({totalVoucherUnits} units)
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
                        {displayedItems.map((item, itemIdx) => {
                          const originalIndex = issue.items.indexOf(item);
                          const actualIndex = originalIndex >= 0 ? originalIndex : itemIdx;
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
                                  onClick={() => openServiceModal(issue, actualIndex)}
                                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                                >
                                  <Wrench className="h-3 w-3" /> Manage / Service
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {isSubFiltered && !showAllInThisIssue && (
                          <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-100/70 p-2 rounded-lg mt-1">
                            <span>
                              {issue.items.length - matchingItems.length} hidden items
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleShowAllInIssue(issue._id)}
                              className="font-bold text-blue-600 hover:underline"
                            >
                              Show all {issue.items.length}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {filteredIssues.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-400">
              No matching issued product records found.
            </p>
          )}

          {filteredIssues.length > 0 && (
            <Pagination
              currentPage={issuePage}
              totalItems={filteredIssues.length}
              pageSize={issuePageSize}
              onPageChange={(p) => setIssuePage(p)}
              onPageSizeChange={(s) => setIssuePageSize(s)}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          )}
        </div>

        {/* 🗑️ Delete Issue Confirmation Modal */}
        {deleteIssueId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-xl">
              <h3 className="text-lg font-bold text-red-600">Delete Issue Record</h3>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to delete this issue record? Any unreturned stock will be automatically restored back to the warehouse inventory.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={handleDeleteIssue}
                  disabled={deleteLoading}
                  className="flex-1 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteLoading ? "Deleting..." : "Delete & Restore Stock"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteIssueId(null)}
                  className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🛠️ Manage / Service Modal */}
        {activeModalData && (
          <ServiceCycleModal
            issue={activeModalData.issue}
            itemIndex={activeModalData.itemIndex}
            onClose={() => setActiveModalIssue(null)}
            onUpdated={handleIssueUpdated}
          />
        )}

        <WarningPopup
          open={warningOpen}
          message={warningMessage}
          onClose={() => setWarningOpen(false)}
        />

        {/* 🧾 Official Bill / Issue Slip Modal */}
        {billIssue && (
          <IssueBillModal issue={billIssue} onClose={() => setBillIssue(null)} />
        )}

        {/* 📦 Top-to-Bottom Product History Modal */}
        {historyProductId && (
          <ProductHistoryModal
            productId={historyProductId}
            onClose={() => setHistoryProductId(null)}
            backLabel="Back to User Assets"
            onSelectEmployee={(emp) => {
              setHistoryProductId(null);
              setHistoryEmployee(emp);
            }}
          />
        )}

        {/* 👤 Top-to-Bottom Employee Asset History Modal */}
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

        {/* ➕ Quick Add Employee Modal */}
        <AddEmployeeModal
          isOpen={isAddEmployeeOpen}
          onClose={() => setIsAddEmployeeOpen(false)}
          onSuccess={(newEmp) => {
            void fetchIssues();
            handleSelectEmployee(newEmp);
          }}
        />
      </div>
    </ProtectedPage>
  );
}
