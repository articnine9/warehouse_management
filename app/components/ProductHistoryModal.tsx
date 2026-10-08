"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  X,
  RotateCcw,
  RefreshCw,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  Box,
  Tag,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  CalendarPlus,
  CornerDownLeft,
  History,
  MessageSquare,
  Building2,
  ExternalLink,
  ChevronRight,
  Info,
  Check,
  Package,
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
    warrantyMonths?: number;
    serviceIntervalMonths?: number;
    sellerName?: string;
    sellerEmail?: string;
    sellerPhone?: string;
    serialNumber?: string;
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
  };
  lifecycleEvents: Array<{
    id: string;
    date: string;
    eventType: string;
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
    itemIndex: number;
    issueDate: string;
    employeeId?: string;
    employeeCode?: string;
    employeeName: string;
    employeeDepartment?: string;
    employeeDesignation?: string;
    employeePhone?: string;
    employeeEmail?: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
    serialNumber?: string;
    productType?: string;
    warehouseId?: string;
    warehouseName: string;
    rackId?: string;
    rackName: string;
    holdingStatus: string;
    returnDueDays?: number;
    returnDueDate?: string;
    renewalCount?: number;
    renewalHistory?: Array<{
      renewalNumber: number;
      renewedAt: string;
      extendedDays: number;
      newDueDate: string;
      notes?: string;
      performedBy?: string;
    }>;
    lastRenewedDate?: string;
    lastServiceDate?: string;
    serviceCount?: number;
    returnedAt?: string;
    returnCondition?: string;
    serviceNotes?: string;
    siteName?: string;
    reason?: string;
    issuedByName?: string;
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
  warehouses?: Array<{ _id: string; name: string; code: string }>;
  racks?: Array<{ _id: string; name: string; code: string; warehouseId: any }>;
}

interface ProductHistoryModalProps {
  productId: string | null;
  onClose: () => void;
  onSelectEmployee?: (employeeIdOrName: string) => void;
  backLabel?: string;
}

export default function ProductHistoryModal({
  productId,
  onClose,
  backLabel = "Back to Inventory",
}: ProductHistoryModalProps) {
  const [data, setData] = useState<ProductHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedHolderIndex, setSelectedHolderIndex] = useState(0);

  // Active Tab: EXTEND, RETURN, HISTORY, COMMENTS
  const [activeTab, setActiveTab] = useState<"EXTEND" | "RETURN" | "HISTORY" | "COMMENTS">("EXTEND");

  // Extend form states
  const [additionalDays, setAdditionalDays] = useState<number>(7);
  const [extensionReason, setExtensionReason] = useState("Project Work");
  const [extensionNotes, setExtensionNotes] = useState("");
  const [extending, setExtending] = useState(false);

  // Return form states
  const [returnWarehouseId, setReturnWarehouseId] = useState("");
  const [returnRackId, setReturnRackId] = useState("");
  const [returnCondition, setReturnCondition] = useState<"GOOD" | "NEEDS_SERVICE" | "DAMAGED">("GOOD");
  const [returnRemarks, setReturnRemarks] = useState("");
  const [returning, setReturning] = useState(false);

  // Toast feedback banner
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Fetch product data from real API
  const fetchProductHistory = useCallback(async () => {
    if (!productId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/history/product/${productId}`);
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch product history:", err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) {
      fetchProductHistory();
    } else {
      setData(null);
    }
  }, [productId, fetchProductHistory]);

  // Active holder selection
  const activeHolders = useMemo(() => {
    if (!data?.employeeHolders) return [];
    return data.employeeHolders.filter((h) => h.holdingStatus !== "RETURNED");
  }, [data?.employeeHolders]);

  const currentHolder = useMemo(() => {
    if (activeHolders.length > 0) {
      return activeHolders[selectedHolderIndex] || activeHolders[0];
    }
    // If no active holders, show most recent holder or null
    return data?.employeeHolders?.[0] || null;
  }, [activeHolders, selectedHolderIndex, data?.employeeHolders]);

  // Set default return warehouse and rack when holder changes
  useEffect(() => {
    if (currentHolder) {
      if (currentHolder.warehouseId) setReturnWarehouseId(currentHolder.warehouseId);
      if (currentHolder.rackId) setReturnRackId(currentHolder.rackId);
    } else if (data?.inventoryLocations?.[0]) {
      const loc = data.inventoryLocations[0];
      if (loc.warehouse?._id) setReturnWarehouseId(loc.warehouse._id);
      if (loc.rack?._id) setReturnRackId(loc.rack._id);
    }
  }, [currentHolder, data?.inventoryLocations]);

  // Available racks for the selected return warehouse
  const availableRacks = useMemo(() => {
    if (!data?.racks || !returnWarehouseId) return [];
    return data.racks.filter((r) => {
      const wId = typeof r.warehouseId === "object" && r.warehouseId !== null ? r.warehouseId._id : r.warehouseId;
      return wId === returnWarehouseId;
    });
  }, [data?.racks, returnWarehouseId]);

  // Calculate new due date preview for Extend form
  const computedNewDueDate = useMemo(() => {
    const base = currentHolder?.returnDueDate ? new Date(currentHolder.returnDueDate) : new Date();
    const effectiveBase = base.getTime() < Date.now() ? new Date() : base;
    const nextDate = new Date(effectiveBase.getTime() + (additionalDays || 1) * 86400000);
    return nextDate;
  }, [currentHolder?.returnDueDate, additionalDays]);

  // Handle Extend Return Date Submission
  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentHolder) return;

    try {
      setExtending(true);
      const res = await fetch(`/api/employee-issues/${currentHolder.issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RENEW_ITEM",
          itemIndex: currentHolder.itemIndex ?? 0,
          extendedDays: additionalDays,
          serviceNotes: [extensionReason, extensionNotes.trim()].filter(Boolean).join(" - "),
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to extend loan");
      }

      showToast(`Return date extended by +${additionalDays} days successfully!`);
      setExtensionNotes("");
      fetchProductHistory();
    } catch (err: any) {
      console.error("Extend error:", err);
      showToast(err.message || "Failed to extend return date", "error");
    } finally {
      setExtending(false);
    }
  };

  // Handle Return Item Submission
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentHolder) return;

    try {
      setReturning(true);
      const res = await fetch(`/api/employee-issues/${currentHolder.issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RETURN",
          itemIndex: currentHolder.itemIndex ?? 0,
          returnWarehouseId: returnWarehouseId || undefined,
          returnRackId: returnRackId || undefined,
          returnCondition: returnCondition,
          serviceNotes: returnRemarks.trim() || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to process return");
      }

      showToast("Item successfully returned and restored to warehouse stock!");
      setReturnRemarks("");
      fetchProductHistory();
    } catch (err: any) {
      console.error("Return error:", err);
      showToast(err.message || "Failed to process return", "error");
    } finally {
      setReturning(false);
    }
  };

  // Generate real Loan History Table Rows
  const loanHistoryRows = useMemo(() => {
    if (!data?.employeeHolders) return [];

    const rows: Array<{
      id: string;
      action: string;
      fromDate: string;
      toDate: string;
      days: number;
      status: "Active" | "Extended" | "Returned" | "Overdue";
      statusColor: string;
      actionedBy: string;
      remarks: string;
      date: string;
    }> = [];

    data.employeeHolders.forEach((holder) => {
      const issueDate = new Date(holder.issueDate);
      const formattedIssueDate = issueDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      // 1. Initial Issue Row
      const initialDue = holder.renewalHistory && holder.renewalHistory.length > 0
        ? new Date(issueDate.getTime() + (holder.returnDueDays || 7) * 86400000)
        : holder.returnDueDate ? new Date(holder.returnDueDate) : new Date(issueDate.getTime() + 7 * 86400000);

      const isInitialActive = !holder.renewalHistory?.length && holder.holdingStatus !== "RETURNED";
      const isPastDue = initialDue.getTime() < Date.now();

      rows.push({
        id: `initial-${holder.issueId}-${holder.itemIndex}`,
        action: "Initial Issue",
        fromDate: formattedIssueDate,
        toDate: initialDue.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        days: holder.returnDueDays || 7,
        status: isInitialActive ? (isPastDue ? "Overdue" : "Active") : "Active",
        statusColor: isInitialActive
          ? isPastDue
            ? "bg-red-50 text-red-600 border border-red-200"
            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-emerald-50 text-emerald-700",
        actionedBy: holder.issuedByName || "Admin",
        remarks: holder.reason ? holder.reason.replace(/_/g, " ") : "-",
        date: `${formattedIssueDate}, ${issueDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
      });

      // 2. Renewal Rows (from real holder.renewalHistory)
      if (holder.renewalHistory && Array.isArray(holder.renewalHistory)) {
        holder.renewalHistory.forEach((ren, renIdx) => {
          const renDate = new Date(ren.renewedAt);
          const isCurrentActiveRen =
            renIdx === holder.renewalHistory!.length - 1 && holder.holdingStatus !== "RETURNED";
          const renDue = new Date(ren.newDueDate);
          const isOverdueRen = renDue.getTime() < Date.now();

          const prevDate = new Date(renDue.getTime() - ren.extendedDays * 86400000);

          rows.push({
            id: `renewal-${holder.issueId}-${holder.itemIndex}-${ren.renewalNumber}`,
            action: "Extended",
            fromDate: prevDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
            toDate: renDue.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
            days: ren.extendedDays,
            status: isCurrentActiveRen
              ? isOverdueRen
                ? "Overdue"
                : "Active"
              : "Extended",
            statusColor: isCurrentActiveRen
              ? isOverdueRen
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-blue-50 text-blue-700 border border-blue-200/60",
            actionedBy: ren.performedBy || "Subin",
            remarks: ren.notes || "Project work",
            date: `${renDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, ${renDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
          });
        });
      }

      // 3. Returned Row (if completed)
      if (holder.returnedAt) {
        const retDate = new Date(holder.returnedAt);
        rows.push({
          id: `return-${holder.issueId}-${holder.itemIndex}`,
          action: "Returned",
          fromDate: formattedIssueDate,
          toDate: retDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          days: Math.max(1, Math.round((retDate.getTime() - issueDate.getTime()) / 86400000)),
          status: "Returned",
          statusColor: "bg-emerald-50 text-emerald-800 border border-emerald-200",
          actionedBy: holder.issuedByName || "Admin",
          remarks: holder.returnCondition ? `Condition: ${holder.returnCondition}` : "Product checked in",
          date: `${retDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, ${retDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
        });
      }
    });

    return rows;
  }, [data?.employeeHolders]);

  if (!productId) return null;

  const product = data?.product;
  const isCurrentlyOnLoan = Boolean(activeHolders.length > 0 && currentHolder && currentHolder.holdingStatus !== "RETURNED");

  // Helper date calculations for Current Assignment
  const takenDateObj = currentHolder?.issueDate ? new Date(currentHolder.issueDate) : null;
  const dueDateObj = currentHolder?.returnDueDate ? new Date(currentHolder.returnDueDate) : null;

  const takenDaysAgo = takenDateObj
    ? Math.max(0, Math.floor((Date.now() - takenDateObj.getTime()) / 86400000))
    : 0;

  const dueDaysRemaining = dueDateObj
    ? Math.round((dueDateObj.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : 0;

  const isOverdue = isCurrentlyOnLoan && dueDaysRemaining < 0;
  const isDueToday = isCurrentlyOnLoan && dueDaysRemaining === 0;
  const isDueSoon = isCurrentlyOnLoan && dueDaysRemaining > 0 && dueDaysRemaining <= 7;

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden animate-in fade-in duration-150">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-xs font-bold text-white shadow-xl transition-all animate-in slide-in-from-top-3 ${
            feedback.type === "success" ? "bg-emerald-600 shadow-emerald-600/30" : "bg-red-600 shadow-red-600/30"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ─── FULL-WIDTH TOP APP BAR (Back to Inventory / Close) ─── */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-8 py-3.5 shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-blue-600 transition active:scale-95 group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 group-hover:bg-blue-50 text-slate-600 group-hover:text-blue-600 transition border border-slate-200/60 shadow-2xs">
            <ArrowLeft className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold">{backLabel}</span>
        </button>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/product-history/${productId}`}
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-2xs"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Dedicated URL</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ─── FULL-PAGE MAIN BODY (Scrollable with max-w-7xl inner container) ─── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {loading ? (
            <div className="py-32 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-700">Loading product information...</p>
              <p className="text-xs text-slate-400">Fetching live custody assignments, loans, and specifications.</p>
            </div>
          ) : !product ? (
            <div className="py-24 text-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Product not found</p>
            </div>
          ) : (
            <>
              {/* Top Split: Left Column (Product Specs) & Right Column (Assignment + Actions) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* ─── LEFT COLUMN: PRODUCT PROFILE CARD ─── */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                  {/* Product Image Area */}
                  <div className="relative rounded-2xl bg-gradient-to-b from-slate-100 to-slate-50 border border-slate-100 p-6 flex items-center justify-center overflow-hidden min-h-[190px]">
                    {/* Badge Top Right */}
                    <div className="absolute top-3 right-3 z-10">
                      {isCurrentlyOnLoan ? (
                        <span className="flex items-center gap-1 rounded-xl bg-blue-600 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs">
                          <RotateCcw className="h-3 w-3" /> On Loan
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-xl bg-emerald-600 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs">
                          <Check className="h-3 w-3" /> In Stock
                        </span>
                      )}
                    </div>

                    {/* Realistic Product Hardware Visual */}
                    <div className="relative flex flex-col items-center justify-center text-center">
                      <div className="h-28 w-44 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-slate-700 shadow-xl flex items-center justify-center p-2 relative">
                        {/* Laptop screen bezel */}
                        <div className="w-full h-full bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 rounded-lg flex flex-col items-center justify-center text-white relative overflow-hidden">
                          <div className="absolute inset-0 bg-radial-gradient opacity-30" />
                          <Box className="h-8 w-8 text-white/90 drop-shadow" />
                          <span className="text-[10px] font-bold text-white/90 mt-1 uppercase tracking-wider">
                            {product.category || "Asset"}
                          </span>
                        </div>
                        {/* Base notch */}
                        <div className="absolute -bottom-2 w-28 h-1.5 bg-slate-600 rounded-b-md" />
                      </div>
                    </div>
                  </div>

                  {/* Product Title & Badges */}
                  <div className="space-y-2">
                    <h2 className="text-lg font-black text-slate-800 tracking-tight leading-snug">
                      {product.name}
                    </h2>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 px-2.5 py-0.5 text-[10px] font-bold">
                        Returnable
                      </span>
                      {product.category && (
                        <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-[10px] font-bold">
                          {product.category}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Specifications List */}
                  <div className="divide-y divide-slate-100 text-xs pt-1">
                    <div className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Box className="h-3.5 w-3.5 text-slate-400" />
                        <span>SKU Code</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">{product.sku}</span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Shield className="h-3.5 w-3.5 text-slate-400" />
                        <span>Brand / Supplier</span>
                      </div>
                      <span className="font-bold text-slate-800">{product.sellerName || "Standard Vendor"}</span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Tag className="h-3.5 w-3.5 text-slate-400" />
                        <span>Model / Item</span>
                      </div>
                      <span className="font-bold text-slate-800 truncate max-w-[160px] text-right" title={product.name}>
                        {product.name}
                      </span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
                        <span>Category</span>
                      </div>
                      <span className="font-medium text-slate-700">{product.category || "General"}</span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>Purchase Date</span>
                      </div>
                      <span className="font-semibold text-slate-700">
                        {product.createdAt
                          ? new Date(product.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "12 Jan 2024"}
                      </span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Shield className="h-3.5 w-3.5 text-slate-400" />
                        <span>Warranty</span>
                      </div>
                      <span className="font-semibold text-slate-700">
                        {product.warrantyMonths
                          ? `${product.warrantyMonths >= 12 ? `${Math.floor(product.warrantyMonths / 12)} Years` : `${product.warrantyMonths} Mos`} (Till ${new Date(new Date(product.createdAt || Date.now()).getTime() + (product.warrantyMonths || 12) * 30 * 86400000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })})`
                          : "Standard 1 Year"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ─── RIGHT COLUMN: CURRENT ASSIGNMENT & ACTION TABS ─── */}
                <div className="lg:col-span-8 space-y-5">
                  {/* 1. CURRENT ASSIGNMENT CARD */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-sm font-bold text-slate-800">Current Assignment</h3>
                      {activeHolders.length > 1 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-slate-400">Multiple loans:</span>
                          <select
                            value={selectedHolderIndex}
                            onChange={(e) => setSelectedHolderIndex(Number(e.target.value))}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 bg-slate-50"
                          >
                            {activeHolders.map((h, i) => (
                              <option key={i} value={i}>
                                {h.employeeName} ({h.quantity} units)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {isCurrentlyOnLoan && currentHolder ? (
                      <>
                        {/* Custodian Profile Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 font-bold border border-slate-200/60 shadow-2xs">
                              <User className="h-6 w-6 text-slate-500" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-base">{currentHolder.employeeName}</p>
                              <p className="text-xs text-slate-500 font-medium">
                                {currentHolder.employeeDepartment || "Operations Team"}
                              </p>
                              <p className="text-[11px] text-slate-400 font-mono">
                                Employee ID: {currentHolder.employeeCode || currentHolder.employeeId?.slice(-6) || "EMP-001"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {currentHolder.employeeEmail && (
                              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-600 font-medium">
                                <Mail className="h-3.5 w-3.5 text-slate-400" />
                                <span>{currentHolder.employeeEmail}</span>
                              </div>
                            )}
                            {currentHolder.employeePhone && (
                              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-600 font-medium">
                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                <span>{currentHolder.employeePhone}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 4 KPI Stat Boxes */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                          {/* Box 1: Taken Date */}
                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1">
                              <Calendar className="h-3.5 w-3.5 text-blue-500" />
                              <span>Taken Date</span>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-800">
                              {takenDateObj
                                ? takenDateObj.toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "02 Oct 2026"}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{takenDaysAgo} days ago</p>
                          </div>

                          {/* Box 2: Due Date */}
                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1">
                              <Calendar className="h-3.5 w-3.5 text-amber-500" />
                              <span>Due Date</span>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-800">
                              {dueDateObj
                                ? dueDateObj.toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "09 Oct 2026"}
                            </p>
                            <p className={`text-[10px] font-semibold mt-0.5 ${
                              isOverdue ? "text-red-600" : isDueToday ? "text-amber-600" : "text-amber-600"
                            }`}>
                              {isOverdue ? `${Math.abs(dueDaysRemaining)}d late` : isDueToday ? "Today" : `In ${dueDaysRemaining} day${dueDaysRemaining > 1 ? "s" : ""}`}
                            </p>
                          </div>

                          {/* Box 3: Total Loan Period */}
                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1">
                              <Clock className="h-3.5 w-3.5 text-indigo-500" />
                              <span>Total Loan Period</span>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-800">
                              {currentHolder.returnDueDays || 7} Days
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {currentHolder.renewalCount ? `${currentHolder.renewalCount}x Renewed` : "Original period"}
                            </p>
                          </div>

                          {/* Box 4: Status */}
                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                              <span>Status</span>
                            </div>
                            <div className="mt-0.5">
                              {isOverdue ? (
                                <span className="inline-block rounded-lg bg-red-100 px-2 py-0.5 text-xs font-black text-red-700">
                                  Overdue
                                </span>
                              ) : isDueToday ? (
                                <span className="inline-block rounded-lg bg-amber-500 text-white px-2 py-0.5 text-xs font-black">
                                  Due Today
                                </span>
                              ) : isDueSoon ? (
                                <span className="inline-block rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                                  Due Soon
                                </span>
                              ) : (
                                <span className="inline-block rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                                  On Loan
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Fallback when not on loan: show warehouse stock status */
                      <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs">Currently in Warehouse Storage</span>
                          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold">
                            {data.summary.totalInStock} units Available
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          This product is currently available in warehouse stock and ready to be issued to employees.
                        </p>
                        {data.inventoryLocations?.[0] && (
                          <div className="text-xs text-slate-600 flex items-center gap-3 pt-1">
                            <span>Warehouse: <b>{data.inventoryLocations[0].warehouse?.name || "Main"}</b></span>
                            <span>Rack: <b>{data.inventoryLocations[0].rack?.name || "Rack 1"}</b></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. ACTION TABS CARD (Extend / Return / History / Comments) */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                    {/* Tabs Bar */}
                    <div className="flex items-center border-b border-slate-200 overflow-x-auto scrollbar-none px-4 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("EXTEND")}
                        className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition border-b-2 whitespace-nowrap ${
                          activeTab === "EXTEND"
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <CalendarPlus className="h-4 w-4" />
                        <span>Extend Return Date</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("RETURN")}
                        className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition border-b-2 whitespace-nowrap ${
                          activeTab === "RETURN"
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <CornerDownLeft className="h-4 w-4" />
                        <span>Return Item</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("HISTORY")}
                        className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition border-b-2 whitespace-nowrap ${
                          activeTab === "HISTORY"
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <History className="h-4 w-4" />
                        <span>Item History</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("COMMENTS")}
                        className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition border-b-2 whitespace-nowrap ${
                          activeTab === "COMMENTS"
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Comments</span>
                      </button>
                    </div>

                    {/* Tab 1: EXTEND RETURN DATE */}
                    {activeTab === "EXTEND" && (
                      <div className="p-5 space-y-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                            <CalendarPlus className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">Extend Return Date</h4>
                            <p className="text-xs text-slate-400">Update the expected return date for this item</p>
                          </div>
                        </div>

                        {!isCurrentlyOnLoan ? (
                          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                            This item is currently not out on loan to any employee.
                          </div>
                        ) : (
                          <form onSubmit={handleExtendSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* New Return Date */}
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                  New Return Date <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 font-bold">
                                  <Calendar className="h-4 w-4 text-slate-400" />
                                  <span>
                                    {computedNewDueDate.toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </span>
                                </div>
                              </div>

                              {/* Additional Days with Quick Pills */}
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                  Additional Days
                                </label>
                                <div className="flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <input
                                      type="number"
                                      min="1"
                                      max="365"
                                      value={additionalDays}
                                      onChange={(e) => setAdditionalDays(Math.max(1, parseInt(e.target.value) || 1))}
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-normal">
                                      days
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {[3, 7, 14, 30].map((pillDays) => (
                                      <button
                                        key={pillDays}
                                        type="button"
                                        onClick={() => setAdditionalDays(pillDays)}
                                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                                          additionalDays === pillDays
                                            ? "bg-blue-600 text-white shadow-2xs"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                      >
                                        +{pillDays}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Reason for Extension */}
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                  Reason for Extension <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={extensionReason}
                                  onChange={(e) => setExtensionReason(e.target.value)}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                  <option value="Project Work">Project Work</option>
                                  <option value="Client Requirement">Client Requirement</option>
                                  <option value="Maintenance AMC">Maintenance AMC</option>
                                  <option value="Field Operations">Field Operations</option>
                                  <option value="Testing & Validation">Testing & Validation</option>
                                  <option value="Other">Other</option>
                                </select>
                              </div>

                              {/* Additional Notes */}
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                  Additional Notes (Optional)
                                </label>
                                <textarea
                                  rows={1}
                                  value={extensionNotes}
                                  onChange={(e) => setExtensionNotes(e.target.value)}
                                  placeholder="Add any additional notes..."
                                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                                />
                              </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center justify-end gap-2.5 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setAdditionalDays(7);
                                  setExtensionNotes("");
                                }}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={extending}
                                className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold transition shadow-xs shadow-blue-600/20 disabled:opacity-50 active:scale-95"
                              >
                                {extending ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    <span>Extending...</span>
                                  </>
                                ) : (
                                  <>
                                    <CalendarPlus className="h-3.5 w-3.5" />
                                    <span>Extend Return Date</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                    {/* Tab 2: RETURN ITEM */}
                    {activeTab === "RETURN" && (
                      <div className="p-5 space-y-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                            <CornerDownLeft className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">Return Item to Stock</h4>
                            <p className="text-xs text-slate-400">Restore held inventory back to warehouse shelves</p>
                          </div>
                        </div>

                        {!isCurrentlyOnLoan ? (
                          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                            This item is already in warehouse stock and has not been issued.
                          </div>
                        ) : (
                          <form onSubmit={handleReturnSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                  Destination Warehouse *
                                </label>
                                <select
                                  value={returnWarehouseId}
                                  onChange={(e) => setReturnWarehouseId(e.target.value)}
                                  required
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                >
                                  {data?.warehouses?.map((wh) => (
                                    <option key={wh._id} value={wh._id}>
                                      {wh.name} ({wh.code})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                  Destination Rack *
                                </label>
                                <select
                                  value={returnRackId}
                                  onChange={(e) => setReturnRackId(e.target.value)}
                                  required
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                >
                                  {availableRacks.map((rk) => (
                                    <option key={rk._id} value={rk._id}>
                                      {rk.name} ({rk.code})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Condition Selector */}
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Physical Condition Check
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setReturnCondition("GOOD")}
                                  className={`p-2.5 rounded-xl border text-center transition ${
                                    returnCondition === "GOOD"
                                      ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-bold ring-2 ring-emerald-500/20"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-emerald-600" />
                                  <span className="text-xs block">Good Condition</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReturnCondition("NEEDS_SERVICE")}
                                  className={`p-2.5 rounded-xl border text-center transition ${
                                    returnCondition === "NEEDS_SERVICE"
                                      ? "bg-amber-50 border-amber-400 text-amber-800 font-bold ring-2 ring-amber-500/20"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <Clock className="h-4 w-4 mx-auto mb-1 text-amber-600" />
                                  <span className="text-xs block">Needs Service</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReturnCondition("DAMAGED")}
                                  className={`p-2.5 rounded-xl border text-center transition ${
                                    returnCondition === "DAMAGED"
                                      ? "bg-red-50 border-red-400 text-red-800 font-bold ring-2 ring-red-500/20"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-red-600" />
                                  <span className="text-xs block">Damaged</span>
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Return Remarks
                              </label>
                              <input
                                type="text"
                                value={returnRemarks}
                                onChange={(e) => setReturnRemarks(e.target.value)}
                                placeholder="e.g. Returned with all accessories, verified working..."
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-2">
                              <button
                                type="button"
                                onClick={() => setReturnRemarks("")}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={returning}
                                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 text-xs font-bold transition shadow-xs shadow-emerald-600/20 disabled:opacity-50 active:scale-95"
                              >
                                {returning ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    <span>Processing Return...</span>
                                  </>
                                ) : (
                                  <>
                                    <CornerDownLeft className="h-3.5 w-3.5" />
                                    <span>Confirm Return & Restore Stock</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                    {/* Tab 3: ITEM HISTORY (Lifecycle Timeline) */}
                    {activeTab === "HISTORY" && (
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-800">Complete Movement History</h4>
                          <span className="text-xs text-slate-400">
                            {data.lifecycleEvents?.length || 0} Events logged
                          </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1 divide-y divide-slate-100">
                          {data.lifecycleEvents?.slice(0, 15).map((ev) => (
                            <div key={ev.id} className="pt-2 text-xs flex items-start justify-between gap-3">
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-800">{ev.title}</p>
                                <p className="text-[11px] text-slate-500">{ev.subtitle || ev.notes || "Event logged"}</p>
                                {ev.location && <span className="text-[10px] text-slate-400">Location: {ev.location}</span>}
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 shrink-0">
                                {new Date(ev.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tab 4: COMMENTS */}
                    {activeTab === "COMMENTS" && (
                      <div className="p-5 space-y-3">
                        <h4 className="text-sm font-bold text-slate-800">Issue Remarks & Notes</h4>
                        {data.employeeHolders?.filter((h) => h.serviceNotes).length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-6">No comments or notes recorded yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {data.employeeHolders
                              ?.filter((h) => h.serviceNotes)
                              .map((h, i) => (
                                <div key={i} className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs space-y-1">
                                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                                    <span className="font-bold text-slate-700">{h.employeeName}</span>
                                    <span>{new Date(h.issueDate).toLocaleDateString("en-IN")}</span>
                                  </div>
                                  <p className="text-slate-800">{h.serviceNotes}</p>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── BOTTOM SECTION: LOAN HISTORY TABLE ─── */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-slate-600" />
                    <h3 className="text-sm font-bold text-slate-800">Loan History</h3>
                  </div>
                  <Link
                    href="/asset-history"
                    onClick={onClose}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    <span>View All History</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {loanHistoryRows.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl">
                    No loan history records found for this product yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase bg-slate-50/40">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Action</th>
                          <th className="py-2.5 px-3">From Date</th>
                          <th className="py-2.5 px-3">To Date</th>
                          <th className="py-2.5 px-3">Days</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Actioned By</th>
                          <th className="py-2.5 px-3">Remarks</th>
                          <th className="py-2.5 px-3 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loanHistoryRows.map((row, idx) => (
                          <tr key={row.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-3 px-3 font-bold text-slate-800">{row.action}</td>
                            <td className="py-3 px-3 text-slate-600">{row.fromDate}</td>
                            <td className="py-3 px-3 text-slate-600">{row.toDate}</td>
                            <td className="py-3 px-3 font-semibold text-slate-800">{row.days}</td>
                            <td className="py-3 px-3">
                              <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${row.statusColor}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-medium">{row.actionedBy}</td>
                            <td className="py-3 px-3 text-slate-500 truncate max-w-[150px]">{row.remarks}</td>
                            <td className="py-3 px-3 text-right text-slate-500 font-mono text-[11px]">{row.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
