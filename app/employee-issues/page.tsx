"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PackageCheck, Search, Trash2, X, Wrench, RotateCcw, Box } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import ServiceCycleBadge from "@/app/components/ServiceCycleBadge";
import WarningPopup from "@/app/components/WarningPopup";
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

export default function EmployeeIssuesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [issues, setIssues] = useState<EmployeeIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

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

  const [reason, setReason] = useState<EmployeeIssue["reason"]>("STAFF_USE");
  const [notes, setNotes] = useState("");
  const [selectedLookupEmployeeId, setSelectedLookupEmployeeId] = useState("");
  const [issueSearchQuery, setIssueSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [issueTypeFilter, setIssueTypeFilter] = useState("ALL");
  const [issuePage, setIssuePage] = useState(1);
  const [issuePageSize, setIssuePageSize] = useState(10);

  // Manage / Service Modal State
  const [activeModalIssue, setActiveModalIssue] = useState<{
    issueId: string;
    itemIndex: number;
  } | null>(null);

  const [deleteIssueId, setDeleteIssueId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (selectedLookupEmployeeId) {
        const matchId = issue.employeeId === selectedLookupEmployeeId;
        const matchName =
          lookupEmployee &&
          issue.employeeName.toLowerCase() === lookupEmployee.name.toLowerCase();
        if (!matchId && !matchName) return false;
      }

      if (statusFilter !== "ALL") {
        const hasStatus = issue.items.some((it) => it.holdingStatus === statusFilter);
        if (!hasStatus) return false;
      }

      if (issueTypeFilter === "REUSABLE") {
        const hasReusable = issue.items.some((it) => it.productType === "REUSABLE");
        if (!hasReusable) return false;
      } else if (issueTypeFilter === "NON_REUSABLE") {
        const hasNormal = issue.items.some((it) => it.productType !== "REUSABLE");
        if (!hasNormal) return false;
      }

      if (!issueSearchQuery.trim()) return true;
      const query = issueSearchQuery.toLowerCase().trim();
      const matchIssue =
        issue.issueNumber.toLowerCase().includes(query) ||
        issue.employeeName.toLowerCase().includes(query) ||
        issue.employeeEmail.toLowerCase().includes(query) ||
        issue.employeePhone?.toLowerCase().includes(query) ||
        issue.employeeDepartment?.toLowerCase().includes(query) ||
        reasonLabels[issue.reason].toLowerCase().includes(query) ||
        issue.issuedByName?.toLowerCase().includes(query);

      const matchItem = issue.items.some(
        (it) =>
          it.productName.toLowerCase().includes(query) ||
          it.sku.toLowerCase().includes(query) ||
          it.serialNumber?.toLowerCase().includes(query)
      );

      return matchIssue || matchItem;
    });
  }, [issues, issueSearchQuery, statusFilter, issueTypeFilter, selectedLookupEmployeeId]);

  const paginatedIssues = useMemo(() => {
    const start = (issuePage - 1) * issuePageSize;
    return filteredIssues.slice(start, start + issuePageSize);
  }, [filteredIssues, issuePage, issuePageSize]);

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
    if (!quantity || quantity <= 0) {
      setWarningMessage("Please enter a valid quantity");
      setWarningOpen(true);
      return;
    }

    if (quantity > currentSelectedInventory.quantity) {
      setWarningMessage(`Requested quantity exceeds available stock (${currentSelectedInventory.quantity})`);
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
      setWarningMessage("Please select an employee");
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
      setReason("STAFF_USE");
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
        <div>
          <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
            Employee Product Issues & Service Tracking
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Issue products to employees, configure service interval cycles (e.g. every 3m / 12m), and track maintenance custody.
          </p>
        </div>

        {/* Issue Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <PackageCheck className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-800">Issue Product to Employee</h2>
          </div>

          <form onSubmit={handleSubmitIssue} className="space-y-4">
            {/* Employee Selection */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div ref={employeeDropdownRef} className="relative">
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Select Employee *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type employee name, code, department..."
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
                  Reason for Issue
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as EmployeeIssue["reason"])}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="STAFF_USE">Staff Use</option>
                  <option value="OFFICE_USE">Office Equipment / Device</option>
                  <option value="UNIFORM">Uniform / Safety Gear</option>
                  <option value="REPLACEMENT">Tool / Replacement</option>
                  <option value="OTHER">Other</option>
                </select>
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

              {/* Product Classification & Return Period (Auto-inherited from product definition) */}
              {currentSelectedInventory && (
                <div
                  className={`rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border ${
                    itemProductType === "REUSABLE"
                      ? "bg-indigo-50/80 border-indigo-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      {itemProductType === "REUSABLE" ? (
                        <>
                          <RotateCcw className="h-4 w-4 text-indigo-600" />
                          <span className="text-indigo-950 font-bold">Reusable Asset</span>
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                            Return / Renewal Tracking Enabled
                          </span>
                        </>
                      ) : (
                        <>
                          <Box className="h-4 w-4 text-slate-600" />
                          <span className="text-slate-800 font-bold">Normal / Consumable Item</span>
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            No return required
                          </span>
                        </>
                      )}
                    </span>
                  </div>

                  {itemProductType === "REUSABLE" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-[11px] font-bold text-indigo-950">Return Validity:</label>
                      <input
                        type="number"
                        min="1"
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
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                            }`}
                          >
                            {d}d
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Service Interval & Warranty */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Service Interval (Recurring Cycle) *
                  </label>
                  <select
                    value={itemServiceInterval}
                    onChange={(e) => updateItemServiceInterval(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 font-medium text-slate-800"
                  >
                    {SERVICE_INTERVAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option value={CUSTOM_INTERVAL_VALUE}>Custom Months...</option>
                  </select>
                </div>

                {itemServiceInterval === CUSTOM_INTERVAL_VALUE && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Enter Custom Months
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 2, 4, 9..."
                      value={customInterval}
                      onChange={(e) => updateCustomInterval(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div>
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

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Warranty (Months)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 12"
                    value={itemWarrantyMonths}
                    onChange={(e) => setItemWarrantyMonths(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                  />
                </div>
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
                      <th className="px-4 py-2.5">Service Interval</th>
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
                              <RotateCcw className="h-2.5 w-2.5" /> Reusable ({item.returnDueDays || 30}d)
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{item.serialNumber || "-"}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-800">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-slate-700 font-semibold">
                          {formatServiceInterval(item.serviceIntervalMonths)}
                        </td>
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
          <div className="border-b border-slate-100 p-4 md:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Issued Product History & Custody ({filteredIssues.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitor products held by employees, reusable return/renewal periods, recurring service cycles, and custody status.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Employee Lookup Dropdown */}
              <select
                value={selectedLookupEmployeeId}
                onChange={(e) => setSelectedLookupEmployeeId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 font-semibold text-slate-700"
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employeeCode} - {emp.name} ({emp.department || "General"})
                  </option>
                ))}
              </select>

              {/* Product Type Filter Toggle */}
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
                  <RotateCcw className="h-3 w-3" /> Reusable
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
                  Normal
                </button>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE (In Use)</option>
                <option value="INACTIVE">INACTIVE (Not Working / Idle)</option>
                <option value="UNDER_SERVICE">UNDER SERVICE</option>
                <option value="RETURNED">RETURNED</option>
              </select>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search employee, product, SKU, serial..."
                  value={issueSearchQuery}
                  onChange={(e) => setIssueSearchQuery(e.target.value)}
                  className="rounded-lg border border-slate-200 pl-8 pr-7 py-1.5 text-xs outline-none focus:border-blue-500 w-full sm:w-60"
                />
                {issueSearchQuery && (
                  <button
                    onClick={() => setIssueSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
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
                    <th className="px-5 py-3">Product & Type</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3">Return / Renew Due</th>
                    <th className="px-5 py-3">Service Cycle</th>
                    <th className="px-5 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedIssues.map((issue) =>
                    issue.items.map((item, itemIdx) => {
                      const issuedDate = new Date(issue.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });

                      const isReusable = item.productType === "REUSABLE" || Boolean(item.returnDueDate);
                      let returnDaysLeft: number | null = null;
                      if (isReusable && item.returnDueDate) {
                        const dueTime = new Date(item.returnDueDate).setHours(0, 0, 0, 0);
                        const nowTime = new Date().setHours(0, 0, 0, 0);
                        returnDaysLeft = Math.round((dueTime - nowTime) / 86400000);
                      }

                      return (
                        <tr key={`${issue._id}-${itemIdx}`} className="hover:bg-slate-50/70 transition">
                          <td className="px-5 py-3.5">
                            <p className="font-bold text-slate-800">{issue.issueNumber}</p>
                            <span className="text-[11px] text-slate-400">{issuedDate}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (issue.employeeId) {
                                  setSelectedLookupEmployeeId(issue.employeeId);
                                } else {
                                  const found = employees.find(
                                    (e) => e.name.toLowerCase() === issue.employeeName.toLowerCase()
                                  );
                                  if (found) setSelectedLookupEmployeeId(found.id);
                                }
                              }}
                              className="font-semibold text-slate-800 text-left hover:text-blue-600 hover:underline transition flex items-center gap-1 group"
                              title="Click to view all assets held by this employee"
                            >
                              <span>{issue.employeeName}</span>
                              <span className="text-[10px] text-blue-600 opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5">
                                <Search className="h-2.5 w-2.5" /> View Products
                              </span>
                            </button>
                            <p className="text-[11px] text-slate-400">
                              {issue.employeeDepartment || "-"} • {issue.employeePhone || "-"}
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-slate-800">
                              {item.productName}{" "}
                              <span className="font-bold text-blue-600">({item.quantity} units)</span>
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-slate-400">
                                SKU: {item.sku} {item.serialNumber && `• SN: ${item.serialNumber}`}
                              </span>
                              {isReusable && (
                                <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700">
                                  Reusable
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
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

                          {/* Return / Renew Due Column */}
                          <td className="px-5 py-3.5">
                            {item.holdingStatus === "RETURNED" ? (
                              <span className="text-slate-400 text-xs">Item Returned</span>
                            ) : isReusable && item.returnDueDate ? (
                              <div>
                                <p className="font-bold text-xs text-slate-800">
                                  {new Date(item.returnDueDate).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
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
                              <span className="text-slate-400 text-xs">Standard Item</span>
                            )}
                          </td>

                          <td className="px-5 py-3.5">
                            <ServiceCycleBadge
                              intervalMonths={item.serviceIntervalMonths}
                              lastServiceDate={item.lastServiceDate}
                              issuedAt={issue.createdAt}
                              hideDueDate={item.holdingStatus === "RETURNED"}
                            />
                          </td>

                          <td className="px-5 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openServiceModal(issue, itemIdx)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition flex items-center gap-1"
                              >
                                <Wrench className="h-3.5 w-3.5 text-blue-600" /> Manage / Service
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteIssueId(issue._id)}
                                className="p-1 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition"
                                title="Delete this issue record"
                              >
                                <Trash2 className="h-4 w-4" />
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
          )}

          {/* Mobile Cards */}
          {paginatedIssues.length > 0 && (
            <div className="space-y-3 p-4 md:hidden">
              {paginatedIssues.map((issue) =>
                issue.items.map((item, itemIdx) => {
                  return (
                    <div
                      key={`${issue._id}-${itemIdx}`}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-slate-800">{item.productName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Holder:{" "}
                            <button
                              type="button"
                              onClick={() => {
                                if (issue.employeeId) {
                                  setSelectedLookupEmployeeId(issue.employeeId);
                                } else {
                                  const found = employees.find(
                                    (e) => e.name.toLowerCase() === issue.employeeName.toLowerCase()
                                  );
                                  if (found) setSelectedLookupEmployeeId(found.id);
                                }
                              }}
                              className="font-bold text-blue-600 underline hover:text-blue-800"
                              title="Click to view all assets held by this employee"
                            >
                              {issue.employeeName}
                            </button>{" "}
                            ({issue.employeeDepartment || "-"})
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              item.holdingStatus === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700"
                                : item.holdingStatus === "INACTIVE"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {item.holdingStatus}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDeleteIssueId(issue._id)}
                            className="p-1 text-red-500 hover:text-red-700"
                            title="Delete issue"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg space-y-1.5">
                        <p>
                          Issue #{issue.issueNumber} • Qty: <b>{item.quantity}</b> {item.serialNumber && `• SN: ${item.serialNumber}`}
                        </p>
                        <ServiceCycleBadge
                          intervalMonths={item.serviceIntervalMonths}
                          lastServiceDate={item.lastServiceDate}
                          issuedAt={issue.createdAt}
                          hideDueDate={item.holdingStatus === "RETURNED"}
                        />
                        <p>
                          Services completed: <b>{item.serviceCount || 0} times</b>
                        </p>
                      </div>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => openServiceModal(issue, itemIdx)}
                          className="w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                        >
                          <Wrench className="h-3.5 w-3.5 text-blue-600" /> Manage / Service
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {filteredIssues.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-400">No issued product records found.</p>
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
      </div>
    </ProtectedPage>
  );
}
