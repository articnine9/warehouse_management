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
  Wrench,
  Search,
  Users,
  Warehouse,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  BadgeCheck,
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

interface LoanHistoryRow {
  id: string;
  issueId: string;
  issueNumber: string;
  itemIndex: number;
  employeeId?: string;
  employeeCode: string;
  employeeName: string;
  employeeDepartment: string;
  employeeDesignation?: string;
  employeePhone?: string;
  employeeEmail?: string;
  action: "Initial Issue" | "Extended" | "Returned";
  fromDate: string;
  toDate: string;
  days: number;
  status: "Active" | "Extended" | "Returned" | "Overdue";
  statusColor: string;
  actionedBy: string;
  remarks: string;
  date: string;
  timestamp: number;
}

export default function ProductHistoryModal({
  productId,
  onClose,
  onSelectEmployee,
  backLabel = "Back to Inventory",
}: ProductHistoryModalProps) {
  const [data, setData] = useState<ProductHistoryData | null>(null);
  const [loading, setLoading] = useState(false);

  // ─── TOP-LEVEL MAIN VIEW TAB: PRODUCT_HISTORY vs LOAN_HISTORY ───
  const [mainViewTab, setMainViewTab] = useState<"PRODUCT_HISTORY" | "LOAN_HISTORY">("PRODUCT_HISTORY");

  // Active Holder Selection (when managing an active loan)
  const [selectedHolderIndex, setSelectedHolderIndex] = useState(0);

  // Active Loan Action Sub-tab: EXTEND, RETURN, COMMENTS
  const [activeLoanActionTab, setActiveLoanActionTab] = useState<"EXTEND" | "RETURN" | "COMMENTS">("EXTEND");

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

  // Loan History Tab Filters
  const [loanSearchQuery, setLoanSearchQuery] = useState("");
  const [loanStatusFilter, setLoanStatusFilter] = useState<"ALL" | "ACTIVE" | "RETURNED" | "OVERDUE" | "EXTENDED">("ALL");

  // Product History Tab Movements Filter
  const [movementSearchQuery, setMovementSearchQuery] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<"ALL" | "INWARD" | "OUTWARD">("ALL");

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

  // Active holders calculation
  const activeHolders = useMemo(() => {
    if (!data?.employeeHolders) return [];
    return data.employeeHolders.filter((h) => h.holdingStatus !== "RETURNED");
  }, [data?.employeeHolders]);

  const currentHolder = useMemo(() => {
    if (activeHolders.length > 0) {
      return activeHolders[selectedHolderIndex] || activeHolders[0];
    }
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
    return new Date(effectiveBase.getTime() + (additionalDays || 1) * 86400000);
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
        throw new Error(resData.error || resData.message || "Failed to process return");
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

  // ─── GENERATE FULL LOAN HISTORY ROWS WITH EMPLOYEE DETAILS ───
  const loanHistoryRows = useMemo(() => {
    if (!data?.employeeHolders) return [];

    const rows: LoanHistoryRow[] = [];

    data.employeeHolders.forEach((holder) => {
      const issueDate = new Date(holder.issueDate);
      const formattedIssueDate = issueDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const empCode = holder.employeeCode || holder.employeeId?.slice(-6) || "EMP";
      const empDept = holder.employeeDepartment || "General";

      // 1. Initial Issue Row
      const initialDue =
        holder.renewalHistory && holder.renewalHistory.length > 0
          ? new Date(issueDate.getTime() + (holder.returnDueDays || 7) * 86400000)
          : holder.returnDueDate
          ? new Date(holder.returnDueDate)
          : new Date(issueDate.getTime() + 7 * 86400000);

      const hasRenewals = Boolean(holder.renewalHistory && holder.renewalHistory.length > 0);
      const isReturned = holder.holdingStatus === "RETURNED";
      const isPastDue = initialDue.getTime() < Date.now();

      let initialStatus: "Active" | "Extended" | "Returned" | "Overdue" = "Active";
      let initialColor = "bg-emerald-50 text-emerald-700 border border-emerald-200";

      if (isReturned) {
        initialStatus = "Returned";
        initialColor = "bg-slate-100 text-slate-700 border border-slate-200";
      } else if (hasRenewals) {
        initialStatus = "Extended";
        initialColor = "bg-blue-50 text-blue-700 border border-blue-200/60";
      } else if (isPastDue) {
        initialStatus = "Overdue";
        initialColor = "bg-red-50 text-red-600 border border-red-200";
      }

      rows.push({
        id: `initial-${holder.issueId}-${holder.itemIndex}`,
        issueId: holder.issueId,
        issueNumber: holder.issueNumber || "ISSUE-001",
        itemIndex: holder.itemIndex,
        employeeId: holder.employeeId,
        employeeCode: empCode,
        employeeName: holder.employeeName,
        employeeDepartment: empDept,
        employeeDesignation: holder.employeeDesignation,
        employeePhone: holder.employeePhone,
        employeeEmail: holder.employeeEmail,
        action: "Initial Issue",
        fromDate: formattedIssueDate,
        toDate: initialDue.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        days: holder.returnDueDays || 7,
        status: initialStatus,
        statusColor: initialColor,
        actionedBy: holder.issuedByName || "Admin",
        remarks: holder.reason ? holder.reason.replace(/_/g, " ") : "Initial equipment issue",
        date: `${formattedIssueDate}, ${issueDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
        timestamp: issueDate.getTime(),
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

          let renStatus: "Active" | "Extended" | "Returned" | "Overdue" = "Extended";
          let renColor = "bg-blue-50 text-blue-700 border border-blue-200/60";

          if (isReturned) {
            renStatus = "Returned";
            renColor = "bg-slate-100 text-slate-700 border border-slate-200";
          } else if (isCurrentActiveRen) {
            if (isOverdueRen) {
              renStatus = "Overdue";
              renColor = "bg-red-50 text-red-600 border border-red-200";
            } else {
              renStatus = "Active";
              renColor = "bg-emerald-50 text-emerald-700 border border-emerald-200";
            }
          }

          rows.push({
            id: `renewal-${holder.issueId}-${holder.itemIndex}-${ren.renewalNumber}`,
            issueId: holder.issueId,
            issueNumber: holder.issueNumber || "ISSUE-001",
            itemIndex: holder.itemIndex,
            employeeId: holder.employeeId,
            employeeCode: empCode,
            employeeName: holder.employeeName,
            employeeDepartment: empDept,
            employeeDesignation: holder.employeeDesignation,
            employeePhone: holder.employeePhone,
            employeeEmail: holder.employeeEmail,
            action: "Extended",
            fromDate: prevDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
            toDate: renDue.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
            days: ren.extendedDays,
            status: renStatus,
            statusColor: renColor,
            actionedBy: ren.performedBy || "Admin",
            remarks: ren.notes || "Due date extension",
            date: `${renDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, ${renDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
            timestamp: renDate.getTime(),
          });
        });
      }

      // 3. Returned Row (if completed)
      if (holder.returnedAt) {
        const retDate = new Date(holder.returnedAt);
        rows.push({
          id: `return-${holder.issueId}-${holder.itemIndex}`,
          issueId: holder.issueId,
          issueNumber: holder.issueNumber || "ISSUE-001",
          itemIndex: holder.itemIndex,
          employeeId: holder.employeeId,
          employeeCode: empCode,
          employeeName: holder.employeeName,
          employeeDepartment: empDept,
          employeeDesignation: holder.employeeDesignation,
          employeePhone: holder.employeePhone,
          employeeEmail: holder.employeeEmail,
          action: "Returned",
          fromDate: formattedIssueDate,
          toDate: retDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          days: Math.max(1, Math.round((retDate.getTime() - issueDate.getTime()) / 86400000)),
          status: "Returned",
          statusColor: "bg-emerald-50 text-emerald-800 border border-emerald-200",
          actionedBy: holder.issuedByName || "Admin",
          remarks: holder.returnCondition
            ? `Condition: ${holder.returnCondition}${holder.serviceNotes ? ` - ${holder.serviceNotes}` : ""}`
            : holder.serviceNotes || "Item restored to warehouse stock",
          date: `${retDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, ${retDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
          timestamp: retDate.getTime(),
        });
      }
    });

    return rows.sort((a, b) => b.timestamp - a.timestamp);
  }, [data?.employeeHolders]);

  // Loan status filter & search
  const filteredLoanHistoryRows = useMemo(() => {
    return loanHistoryRows.filter((row) => {
      if (loanStatusFilter !== "ALL") {
        if (loanStatusFilter === "ACTIVE" && row.status !== "Active") return false;
        if (loanStatusFilter === "RETURNED" && row.status !== "Returned") return false;
        if (loanStatusFilter === "OVERDUE" && row.status !== "Overdue") return false;
        if (loanStatusFilter === "EXTENDED" && row.status !== "Extended") return false;
      }

      if (loanSearchQuery.trim()) {
        const q = loanSearchQuery.toLowerCase().trim();
        const matchesName = row.employeeName.toLowerCase().includes(q);
        const matchesCode = row.employeeCode.toLowerCase().includes(q);
        const matchesDept = row.employeeDepartment.toLowerCase().includes(q);
        const matchesIssue = row.issueNumber.toLowerCase().includes(q);
        const matchesRemarks = row.remarks.toLowerCase().includes(q);
        const matchesAction = row.action.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDept && !matchesIssue && !matchesRemarks && !matchesAction) {
          return false;
        }
      }

      return true;
    });
  }, [loanHistoryRows, loanStatusFilter, loanSearchQuery]);

  // Loan Status Counts
  const loanCounts = useMemo(() => {
    return {
      all: loanHistoryRows.length,
      active: loanHistoryRows.filter((r) => r.status === "Active").length,
      returned: loanHistoryRows.filter((r) => r.status === "Returned").length,
      overdue: loanHistoryRows.filter((r) => r.status === "Overdue").length,
      extended: loanHistoryRows.filter((r) => r.status === "Extended").length,
    };
  }, [loanHistoryRows]);

  // Filtered Stock Movements in Product Tab
  const filteredMovements = useMemo(() => {
    if (!data?.movements) return [];
    return data.movements.filter((m) => {
      if (movementTypeFilter !== "ALL" && m.movementType !== movementTypeFilter) return false;
      if (movementSearchQuery.trim()) {
        const q = movementSearchQuery.toLowerCase().trim();
        const matchesReason = m.reason?.toLowerCase().includes(q);
        const matchesRef = m.referenceNumber?.toLowerCase().includes(q);
        const matchesNotes = m.notes?.toLowerCase().includes(q);
        const matchesWh = m.warehouseName?.toLowerCase().includes(q);
        const matchesRk = m.rackName?.toLowerCase().includes(q);
        const matchesPerson = m.performedByName?.toLowerCase().includes(q);
        if (!matchesReason && !matchesRef && !matchesNotes && !matchesWh && !matchesRk && !matchesPerson) {
          return false;
        }
      }
      return true;
    });
  }, [data?.movements, movementTypeFilter, movementSearchQuery]);

  const movementCounts = useMemo(() => {
    const list = data?.movements || [];
    return {
      all: list.length,
      inward: list.filter((m) => m.movementType === "INWARD").length,
      outward: list.filter((m) => m.movementType === "OUTWARD").length,
    };
  }, [data?.movements]);

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
    <div className="fixed inset-0 z-50 w-screen h-screen bg-slate-100/80 flex flex-col overflow-hidden animate-in fade-in duration-150 backdrop-blur-xs">
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

      {/* ─── APP BAR HEADER (Back / Product Title / Open Dedicated / Close) ─── */}
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

        {product && (
          <div className="hidden md:flex items-center gap-2.5">
            <span className="text-sm font-bold text-slate-900">{product.name}</span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-semibold text-slate-600 border border-slate-200/60">
              {product.sku}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <Link
            href={`/product-history/${productId}`}
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-2xs"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dedicated Page</span>
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

      {/* ─── SEGMENTED NAVIGATION TABS (Product & Stock History vs Loan History) ─── */}
      <div className="bg-white border-b border-slate-200/90 px-4 sm:px-8 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 py-2 overflow-x-auto scrollbar-none">
            {/* Tab 1: Product & Stock History */}
            <button
              type="button"
              onClick={() => setMainViewTab("PRODUCT_HISTORY")}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                mainViewTab === "PRODUCT_HISTORY"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Package className="h-4 w-4" />
              <span>Product & Stock History</span>
              {data && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    mainViewTab === "PRODUCT_HISTORY"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {data.summary.totalInStock} In Stock
                </span>
              )}
            </button>

            {/* Tab 2: Loan History */}
            <button
              type="button"
              onClick={() => setMainViewTab("LOAN_HISTORY")}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                mainViewTab === "LOAN_HISTORY"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <RotateCcw className="h-4 w-4" />
              <span>Loan History</span>
              {data && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    mainViewTab === "LOAN_HISTORY"
                      ? "bg-white/20 text-white"
                      : isCurrentlyOnLoan
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {data.summary.totalUnitsActiveIssued} On Loan
                </span>
              )}
            </button>
          </div>

          {/* Quick Context Pill */}
          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500 py-1.5">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <Layers className="h-3.5 w-3.5 text-slate-400" />
              <span>Category:</span>
              <b className="text-slate-800">{product?.category || "General"}</b>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <Warehouse className="h-3.5 w-3.5 text-slate-400" />
              <span>Warehouses:</span>
              <b className="text-slate-800">{data?.inventoryLocations?.length || 0} racks</b>
            </span>
          </div>
        </div>
      </div>

      {/* ─── SCROLLABLE MAIN CONTENT BODY ─── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {loading ? (
            <div className="py-32 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-700">Loading product information...</p>
              <p className="text-xs text-slate-400">Fetching live inventory, warehouse racks, movements, and custody history.</p>
            </div>
          ) : !product ? (
            <div className="py-24 text-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Product not found</p>
            </div>
          ) : mainViewTab === "PRODUCT_HISTORY" ? (
            <>
              {/* Top Stock KPI Strip (4 Equal Cards matching Loan History) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Warehouse Stock</span>
                    <Package className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-xl font-black text-slate-900 mt-2">{data.summary.totalInStock} Units</p>
                  <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                    Available in warehouse
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Units on Loan</span>
                    <RotateCcw className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-xl font-black text-slate-900 mt-2">{data.summary.totalUnitsActiveIssued} Units</p>
                  <p className="text-[11px] text-blue-700 font-medium mt-0.5">
                    {activeHolders.length} active borrower(s)
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Stock Movements</span>
                    <History className="h-4 w-4 text-indigo-600" />
                  </div>
                  <p className="text-xl font-black text-slate-900 mt-2">{data.movements?.length || 0} Records</p>
                  <p className="text-[11px] text-indigo-700 font-medium mt-0.5">
                    Inward & outward log trail
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Storage Shelves</span>
                    <Warehouse className="h-4 w-4 text-slate-600" />
                  </div>
                  <p className="text-xl font-black text-slate-900 mt-2">
                    {data.inventoryLocations?.length || 0} Racks
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Active warehouse racks
                  </p>
                </div>
              </div>

              {/* Balanced Middle Section: Left (Product Specs) & Right (Warehouse Shelves + Initial Inward) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* ─── LEFT COLUMN (6 cols): PRODUCT PROFILE & SPECIFICATIONS ─── */}
                <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    {/* Visual Hardware Area */}
                    <div className="relative rounded-2xl bg-gradient-to-b from-slate-100 to-slate-50 border border-slate-100 p-6 flex items-center justify-center overflow-hidden min-h-[160px]">
                      <div className="absolute top-3 right-3 z-10">
                        {data.summary.totalInStock > 0 ? (
                          <span className="flex items-center gap-1 rounded-xl bg-emerald-600 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs">
                            <Check className="h-3 w-3" /> In Stock ({data.summary.totalInStock})
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-xl bg-rose-600 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs">
                            <AlertTriangle className="h-3 w-3" /> No Stock
                          </span>
                        )}
                      </div>

                      <div className="relative flex flex-col items-center justify-center text-center">
                        <div className="h-24 w-40 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-slate-700 shadow-xl flex items-center justify-center p-2 relative">
                          <div className="w-full h-full bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 rounded-lg flex flex-col items-center justify-center text-white relative overflow-hidden">
                            <div className="absolute inset-0 bg-radial-gradient opacity-30" />
                            <Box className="h-7 w-7 text-white/90 drop-shadow" />
                            <span className="text-[10px] font-bold text-white/90 mt-1 uppercase tracking-wider">
                              {product.category || "Asset"}
                            </span>
                          </div>
                          <div className="absolute -bottom-2 w-24 h-1.5 bg-slate-600 rounded-b-md" />
                        </div>
                      </div>
                    </div>

                    {/* Title & Badges */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-slate-800 tracking-tight leading-snug">
                          {product.name}
                        </h2>
                        <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200">
                          {product.sku}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 px-2.5 py-0.5 text-[10px] font-bold">
                          Returnable Asset
                        </span>
                        {product.category && (
                          <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-[10px] font-bold">
                            {product.category}
                          </span>
                        )}
                        {product.unit && (
                          <span className="rounded-full bg-slate-100 text-slate-500 px-2.5 py-0.5 text-[10px] font-semibold">
                            Unit: {product.unit}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Specifications 2-column grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="py-1.5 flex items-center justify-between border-b border-slate-50">
                        <span className="text-slate-500">Brand / Supplier</span>
                        <span className="font-bold text-slate-800 truncate max-w-[130px]" title={product.sellerName || "Standard Vendor"}>
                          {product.sellerName || "Standard Vendor"}
                        </span>
                      </div>

                      <div className="py-1.5 flex items-center justify-between border-b border-slate-50">
                        <span className="text-slate-500">Unit Price</span>
                        <span className="font-bold text-slate-900">
                          {product.price !== undefined ? `₹${Number(product.price).toLocaleString("en-IN")}` : "₹0"}
                        </span>
                      </div>

                      <div className="py-1.5 flex items-center justify-between border-b border-slate-50">
                        <span className="text-slate-500">Warranty</span>
                        <span className="font-semibold text-slate-700">
                          {product.warrantyMonths ? `${product.warrantyMonths} Months` : "Standard 1 Year"}
                        </span>
                      </div>

                      <div className="py-1.5 flex items-center justify-between border-b border-slate-50">
                        <span className="text-slate-500">Catalog Date</span>
                        <span className="font-semibold text-slate-700">
                          {product.createdAt
                            ? new Date(product.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : "12 Jan 2024"}
                        </span>
                      </div>

                      {product.serviceIntervalMonths && (
                        <div className="py-1.5 flex items-center justify-between border-b border-slate-50 sm:col-span-2">
                          <span className="text-slate-500">Service Cycle</span>
                          <span className="font-semibold text-slate-700">Every {product.serviceIntervalMonths} Months</span>
                        </div>
                      )}
                    </div>

                    {product.description && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</p>
                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          {product.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── RIGHT COLUMN (6 cols): WAREHOUSE STORAGE & INITIAL ARRIVAL ─── */}
                <div className="lg:col-span-6 flex flex-col gap-4">
                  {/* 1. Warehouse Storage & Shelves */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex-1 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-blue-600" />
                        <h3 className="text-sm font-bold text-slate-800">Warehouse Storage & Shelves</h3>
                      </div>
                      <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold">
                        {data.summary.totalInStock} Total In Stock
                      </span>
                    </div>

                    {data.inventoryLocations && data.inventoryLocations.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[175px] overflow-y-auto pr-1">
                        {data.inventoryLocations.map((loc) => (
                          <div
                            key={loc.id}
                            className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 hover:border-blue-300 hover:bg-blue-50/20 transition space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 text-xs truncate max-w-[140px]" title={loc.warehouse?.name || "Warehouse"}>
                                {loc.warehouse?.name || "Main Warehouse"}
                              </span>
                              <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                {loc.warehouse?.code || "WH"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs pt-0.5">
                              <div className="flex items-center gap-1 text-slate-600">
                                <Box className="h-3 w-3 text-slate-400" />
                                <span className="text-[11px]">Rack: <b>{loc.rack?.name || "Unassigned"}</b></span>
                              </div>
                              <span className="font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-[11px]">
                                {loc.quantity} units
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                        No warehouse rack allocations recorded for this product.
                      </div>
                    )}
                  </div>

                  {/* 2. Initial Stock Arrival (Origin Record) */}
                  {data.initialStockArrival ? (
                    <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 rounded-2xl border border-blue-200/80 p-4 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                            <BadgeCheck className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                              Initial Stock Inward Arrival
                            </h4>
                            <p className="text-[10px] text-blue-700">Origin record of first batch received</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-blue-900 font-bold bg-white/80 border border-blue-200 px-2 py-0.5 rounded-lg">
                          {new Date(data.initialStockArrival.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 text-xs">
                        <div className="bg-white/80 rounded-xl p-2 border border-blue-100">
                          <span className="text-[10px] text-slate-400 block font-semibold">Initial Qty</span>
                          <span className="text-xs sm:text-sm font-black text-slate-800">{data.initialStockArrival.quantity} units</span>
                        </div>
                        <div className="bg-white/80 rounded-xl p-2 border border-blue-100">
                          <span className="text-[10px] text-slate-400 block font-semibold">Location</span>
                          <span className="text-[11px] font-bold text-slate-800 truncate block">
                            {data.initialStockArrival.warehouseName} ({data.initialStockArrival.rackName})
                          </span>
                        </div>
                        <div className="bg-white/80 rounded-xl p-2 border border-blue-100">
                          <span className="text-[10px] text-slate-400 block font-semibold">Supplier</span>
                          <span className="text-[11px] font-bold text-slate-800 truncate block">
                            {data.initialStockArrival.supplier || "Supplier Inward"}
                          </span>
                        </div>
                        <div className="bg-white/80 rounded-xl p-2 border border-blue-100">
                          <span className="text-[10px] text-slate-400 block font-semibold">Reference</span>
                          <span className="text-[11px] font-mono font-bold text-slate-700 truncate block">
                            {data.initialStockArrival.referenceNumber || "INITIAL-STOCK"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-4 text-xs text-slate-500 flex items-center gap-3">
                      <Info className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Standard catalog product. Stock movements below record all additions and transfers.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── FULL-WIDTH STOCK MOVEMENT & INVENTORY LOGS TABLE (Matches Loan History Table) ─── */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-slate-800">Stock Movement & Inventory Logs</h3>
                      <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs font-bold">
                        {filteredMovements.length} of {data.movements?.length || 0}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Complete timeline of warehouse inwards, allocations, staff issue checkouts, and return check-ins
                    </p>
                  </div>

                  {/* Filter pills & search */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 text-xs font-bold">
                      {(["ALL", "INWARD", "OUTWARD"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setMovementTypeFilter(t)}
                          className={`px-3 py-1.5 rounded-lg transition ${
                            movementTypeFilter === t
                              ? "bg-white text-slate-800 shadow-2xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {t === "ALL"
                            ? `All Logs (${movementCounts.all})`
                            : t === "INWARD"
                            ? `Inward (+${movementCounts.inward})`
                            : `Outward (-${movementCounts.outward})`}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={movementSearchQuery}
                        onChange={(e) => setMovementSearchQuery(e.target.value)}
                        placeholder="Search reason, ref #, rack, person..."
                        className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      {movementSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setMovementSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {filteredMovements.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl space-y-2">
                    <p className="font-bold text-slate-700 text-sm">No stock movements found</p>
                    <p className="text-slate-400">
                      {movementSearchQuery || movementTypeFilter !== "ALL"
                        ? "No transactions match your search or filter criteria."
                        : "No inventory movements recorded for this product yet."}
                    </p>
                    {(movementSearchQuery || movementTypeFilter !== "ALL") && (
                      <button
                        type="button"
                        onClick={() => {
                          setMovementSearchQuery("");
                          setMovementTypeFilter("ALL");
                        }}
                        className="mt-2 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase bg-slate-50/50">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Movement Type</th>
                          <th className="py-2.5 px-3">Reason / Details</th>
                          <th className="py-2.5 px-3 text-right">Quantity</th>
                          <th className="py-2.5 px-3">Warehouse & Shelf Location</th>
                          <th className="py-2.5 px-3">Reference / Handled By</th>
                          <th className="py-2.5 px-3 text-right">Logged At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMovements.slice(0, 50).map((m, idx) => {
                          const isInward = m.movementType === "INWARD";
                          const dateObj = new Date(m.createdAt);
                          return (
                            <tr key={m.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-3 px-3">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                    isInward
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-blue-50 text-blue-700 border border-blue-200"
                                  }`}
                                >
                                  {isInward ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                  <span>{m.movementType}</span>
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-bold text-slate-800 block">
                                  {m.reason ? m.reason.replace(/_/g, " ") : "Movement"}
                                </span>
                                {m.notes && <span className="text-[11px] text-slate-500 block truncate max-w-[220px]" title={m.notes}>{m.notes}</span>}
                              </td>
                              <td className={`py-3 px-3 text-right font-black ${isInward ? "text-emerald-700" : "text-blue-700"}`}>
                                {isInward ? `+${m.quantity}` : `-${m.quantity}`} units
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                <span className="font-medium text-slate-800 block">{m.warehouseName || "Warehouse"}</span>
                                <span className="text-slate-400 font-mono text-[11px] block">{m.rackName || "Rack Shelf"}</span>
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                <span className="font-mono text-[11px] font-bold text-slate-700 block">{m.referenceNumber || "-"}</span>
                                <span className="text-[11px] text-slate-400 block">{m.performedByName || "Admin"}</span>
                              </td>
                              <td className="py-3 px-3 text-right text-slate-500 font-mono text-[11px] whitespace-nowrap">
                                {dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })},{" "}
                                {dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ══════════════════════════════════════════════════════════════ */
            /* ─── TAB 2: LOAN HISTORY & EMPLOYEE ASSIGNMENTS ───             */
            /* ══════════════════════════════════════════════════════════════ */
            <>
              {/* Top Loan KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Active Units on Loan</span>
                    <RotateCcw className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-xl font-black text-slate-900 mt-2">{data.summary.totalUnitsActiveIssued} Units</p>
                  <p className="text-[11px] text-blue-700 font-medium mt-0.5">{activeHolders.length} active borrower(s)</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Total Returned</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-xl font-black text-slate-900 mt-2">{data.summary.totalUnitsReturned} Units</p>
                  <p className="text-[11px] text-emerald-700 font-medium mt-0.5">Restored to warehouse stock</p>
                </div>

                <div className={`bg-white rounded-2xl border p-4 shadow-xs ${
                  loanCounts.overdue > 0 ? "border-red-200 bg-red-50/20" : "border-slate-200/80"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${loanCounts.overdue > 0 ? "text-red-700" : "text-slate-500"}`}>
                      Overdue Items
                    </span>
                    <AlertTriangle className={`h-4 w-4 ${loanCounts.overdue > 0 ? "text-red-600" : "text-slate-400"}`} />
                  </div>
                  <p className={`text-xl font-black mt-2 ${loanCounts.overdue > 0 ? "text-red-600" : "text-slate-900"}`}>
                    {loanCounts.overdue}
                  </p>
                  <p className={`text-[11px] font-medium mt-0.5 ${loanCounts.overdue > 0 ? "text-red-600 font-bold" : "text-slate-400"}`}>
                    {loanCounts.overdue > 0 ? "Requires return or extension" : "None overdue"}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Total Borrowers</span>
                    <Users className="h-4 w-4 text-indigo-600" />
                  </div>
                  <p className="text-xl font-black text-slate-900 mt-2">
                    {data.summary.totalHolders || data.employeeHolders?.length || 0}
                  </p>
                  <p className="text-[11px] text-indigo-700 font-medium mt-0.5">All historical employee loans</p>
                </div>
              </div>

              {/* ─── ACTIVE CUSTODY CARD & QUICK ACTIONS (EXTEND / RETURN) ─── */}
              {isCurrentlyOnLoan && currentHolder ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Current Active Custody & Quick Actions</h3>
                        <p className="text-[11px] text-slate-500">Manage ongoing loan, extend expected return date, or check item back into stock</p>
                      </div>
                    </div>

                    {activeHolders.length > 1 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 font-medium">Borrower ({activeHolders.length}):</span>
                        <select
                          value={selectedHolderIndex}
                          onChange={(e) => setSelectedHolderIndex(Number(e.target.value))}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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

                  {/* Custodian Profile Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 font-black border border-blue-200/60 shadow-2xs text-base">
                        {currentHolder.employeeName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p
                            className="font-bold text-slate-900 text-base hover:text-blue-600 transition cursor-pointer"
                            onClick={() => onSelectEmployee?.(currentHolder.employeeId || currentHolder.employeeName)}
                            title="Filter this employee"
                          >
                            {currentHolder.employeeName}
                          </p>
                          <span className="rounded-md bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
                            {currentHolder.employeeCode || currentHolder.employeeId?.slice(-6) || "EMP"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          {currentHolder.employeeDepartment || "Operations"}
                          {currentHolder.employeeDesignation && ` • ${currentHolder.employeeDesignation}`}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Issue #{currentHolder.issueNumber || "ISSUE-001"} • Qty: <b>{currentHolder.quantity} unit(s)</b>
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

                  {/* 4 Loan Timing Stat Boxes */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-3 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-900/80 mb-1">
                        <Calendar className="h-3.5 w-3.5 text-blue-600" />
                        <span>Taken Date</span>
                      </div>
                      <p className="text-xs sm:text-sm font-black text-blue-950">
                        {takenDateObj
                          ? takenDateObj.toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "02 Oct 2026"}
                      </p>
                      <p className="text-[10px] text-blue-700/80 mt-0.5">{takenDaysAgo} days ago</p>
                    </div>

                    <div className={`rounded-xl border p-3 shadow-2xs ${
                      isOverdue ? "border-red-200/80 bg-red-50/40" : "border-amber-200/80 bg-amber-50/40"
                    }`}>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold mb-1">
                        <Calendar className={`h-3.5 w-3.5 ${isOverdue ? "text-red-600" : "text-amber-600"}`} />
                        <span className={isOverdue ? "text-red-900/80" : "text-amber-900/80"}>Due Date</span>
                      </div>
                      <p className={`text-xs sm:text-sm font-black ${isOverdue ? "text-red-950" : "text-amber-950"}`}>
                        {dueDateObj
                          ? dueDateObj.toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "09 Oct 2026"}
                      </p>
                      <p className={`text-[10px] font-semibold mt-0.5 ${
                        isOverdue ? "text-red-700/90" : isDueToday ? "text-amber-800" : "text-amber-700/80"
                      }`}>
                        {isOverdue ? `${Math.abs(dueDaysRemaining)}d late` : isDueToday ? "Today" : `In ${dueDaysRemaining} day${dueDaysRemaining > 1 ? "s" : ""}`}
                      </p>
                    </div>

                    <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-900/80 mb-1">
                        <Clock className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Total Loan Period</span>
                      </div>
                      <p className="text-xs sm:text-sm font-black text-indigo-950">
                        {currentHolder.returnDueDays || 7} Days
                      </p>
                      <p className="text-[10px] text-indigo-700/80 mt-0.5">
                        {currentHolder.renewalCount ? `${currentHolder.renewalCount}x Renewed` : "Original period"}
                      </p>
                    </div>

                    <div className={`rounded-xl border p-3 shadow-2xs ${
                      isOverdue
                        ? "border-red-200/80 bg-red-50/40"
                        : isDueToday || isDueSoon
                        ? "border-amber-200/80 bg-amber-50/40"
                        : "border-emerald-200/80 bg-emerald-50/40"
                    }`}>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold mb-1">
                        <AlertTriangle className={`h-3.5 w-3.5 ${
                          isOverdue ? "text-red-600" : isDueToday || isDueSoon ? "text-amber-600" : "text-emerald-600"
                        }`} />
                        <span className={
                          isOverdue ? "text-red-900/80" : isDueToday || isDueSoon ? "text-amber-900/80" : "text-emerald-900/80"
                        }>Status</span>
                      </div>
                      <div className="mt-0.5">
                        {isOverdue ? (
                          <span className="inline-block rounded-lg bg-red-600 text-white px-2 py-0.5 text-xs font-black shadow-2xs">
                            Overdue
                          </span>
                        ) : isDueToday ? (
                          <span className="inline-block rounded-lg bg-amber-500 text-white px-2 py-0.5 text-xs font-black shadow-2xs">
                            Due Today
                          </span>
                        ) : isDueSoon ? (
                          <span className="inline-block rounded-lg bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-bold shadow-2xs">
                            Due Soon
                          </span>
                        ) : (
                          <span className="inline-block rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-xs font-bold shadow-2xs">
                            On Loan
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Section Tabs (Extend / Return / Comments) */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 overflow-hidden">
                    <div className="flex items-center border-b border-slate-200 bg-white px-4 pt-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveLoanActionTab("EXTEND")}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 whitespace-nowrap ${
                          activeLoanActionTab === "EXTEND"
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <CalendarPlus className="h-4 w-4" />
                        <span>Extend Return Date</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveLoanActionTab("RETURN")}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 whitespace-nowrap ${
                          activeLoanActionTab === "RETURN"
                            ? "border-emerald-600 text-emerald-600"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <CornerDownLeft className="h-4 w-4" />
                        <span>Return Item to Stock</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveLoanActionTab("COMMENTS")}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 whitespace-nowrap ${
                          activeLoanActionTab === "COMMENTS"
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Comments & Notes</span>
                      </button>
                    </div>

                    {/* Sub-Tab 1: EXTEND RETURN DATE */}
                    {activeLoanActionTab === "EXTEND" && (
                      <div className="p-4 sm:p-5 bg-white space-y-4">
                        <form onSubmit={handleExtendSubmit} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                New Expected Return Date <span className="text-red-500">*</span>
                              </label>
                              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 font-bold">
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

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Additional Notes (Optional)
                              </label>
                              <textarea
                                rows={1}
                                value={extensionNotes}
                                onChange={(e) => setExtensionNotes(e.target.value)}
                                placeholder="Add any details or approvals..."
                                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setAdditionalDays(7);
                                setExtensionNotes("");
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                            >
                              Reset
                            </button>
                            <button
                              type="submit"
                              disabled={extending}
                              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold transition shadow-xs shadow-blue-600/20 disabled:opacity-50 active:scale-95"
                            >
                              {extending ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  <span>Extending Return Date...</span>
                                </>
                              ) : (
                                <>
                                  <CalendarPlus className="h-3.5 w-3.5" />
                                  <span>Confirm Extension</span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* Sub-Tab 2: RETURN ITEM */}
                    {activeLoanActionTab === "RETURN" && (
                      <div className="p-4 sm:p-5 bg-white space-y-4">
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

                          {/* Physical Condition Checked */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Physical Condition Verification
                            </label>
                            <div className="grid grid-cols-3 gap-2.5">
                              <button
                                type="button"
                                onClick={() => setReturnCondition("GOOD")}
                                className={`p-3 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${
                                  returnCondition === "GOOD"
                                    ? "bg-emerald-50/90 border-2 border-emerald-500 shadow-sm ring-4 ring-emerald-500/20 scale-[1.02]"
                                    : "bg-emerald-50/35 border border-emerald-200/80 hover:bg-emerald-50/70"
                                }`}
                              >
                                <div
                                  className={`w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center transition-all ${
                                    returnCondition === "GOOD"
                                      ? "bg-emerald-500 text-white shadow-xs"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  <Check className="h-4 w-4 stroke-[2.5]" />
                                </div>
                                <span className="text-xs font-bold text-emerald-950 block">Good Condition</span>
                                <span className="text-[10px] text-emerald-700 font-medium block">Ready to reissue</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setReturnCondition("NEEDS_SERVICE")}
                                className={`p-3 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${
                                  returnCondition === "NEEDS_SERVICE"
                                    ? "bg-amber-50/90 border-2 border-amber-500 shadow-sm ring-4 ring-amber-500/20 scale-[1.02]"
                                    : "bg-amber-50/35 border border-amber-200/80 hover:bg-amber-50/70"
                                }`}
                              >
                                <div
                                  className={`w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center transition-all ${
                                    returnCondition === "NEEDS_SERVICE"
                                      ? "bg-amber-500 text-white shadow-xs"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  <Wrench className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-amber-950 block">Needs Service</span>
                                <span className="text-[10px] text-amber-800 font-medium block">Requires check</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setReturnCondition("DAMAGED")}
                                className={`p-3 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${
                                  returnCondition === "DAMAGED"
                                    ? "bg-rose-50/90 border-2 border-rose-500 shadow-sm ring-4 ring-rose-500/20 scale-[1.02]"
                                    : "bg-rose-50/35 border border-rose-200/80 hover:bg-rose-50/70"
                                }`}
                              >
                                <div
                                  className={`w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center transition-all ${
                                    returnCondition === "DAMAGED"
                                      ? "bg-rose-500 text-white shadow-xs"
                                      : "bg-rose-100 text-rose-700"
                                  }`}
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-rose-950 block">Damaged</span>
                                <span className="text-[10px] text-rose-800 font-medium block">Field damaged</span>
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
                              placeholder="e.g. Returned in good working condition with charger..."
                              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setReturnRemarks("")}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                            >
                              Clear
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
                      </div>
                    )}

                    {/* Sub-Tab 3: COMMENTS */}
                    {activeLoanActionTab === "COMMENTS" && (
                      <div className="p-4 sm:p-5 bg-white space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Custodian Notes & Log History</h4>
                        {data.employeeHolders?.filter((h) => h.serviceNotes).length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl">
                            No special remarks or notes recorded for this item yet.
                          </p>
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
              ) : (
                /* No Active Loan Banner */
                <div className="bg-emerald-50/50 rounded-2xl border border-emerald-200/80 p-5 shadow-xs flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-2xs">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">No Active Employee Loans</h4>
                      <p className="text-xs text-emerald-800/80">
                        All {data.summary.totalInStock} units of this product are currently safely stored in warehouse stock.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/employee-issues"
                    onClick={onClose}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-4 py-2 text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
                  >
                    <span>Issue to Employee</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              {/* ─── FULL LOAN RECORDS TABLE (FILTERABLE & SEARCHABLE INSIDE MODAL) ─── */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-slate-800">
                        Complete Loan History Records
                      </h3>
                      <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs font-bold">
                        {filteredLoanHistoryRows.length} of {loanHistoryRows.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      All historical employee lending, renewals, and returned check-ins for this product
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Link
                      href="/asset-history"
                      onClick={onClose}
                      className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-600 transition"
                      title="Company-wide asset history across all products"
                    >
                      <span>Organization Master Log</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-t border-slate-100">
                  {/* Status Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setLoanStatusFilter("ALL")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        loanStatusFilter === "ALL"
                          ? "bg-slate-900 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All ({loanCounts.all})
                    </button>

                    <button
                      type="button"
                      onClick={() => setLoanStatusFilter("ACTIVE")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        loanStatusFilter === "ACTIVE"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      Active ({loanCounts.active})
                    </button>

                    <button
                      type="button"
                      onClick={() => setLoanStatusFilter("RETURNED")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        loanStatusFilter === "RETURNED"
                          ? "bg-slate-700 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      Returned ({loanCounts.returned})
                    </button>

                    {loanCounts.overdue > 0 && (
                      <button
                        type="button"
                        onClick={() => setLoanStatusFilter("OVERDUE")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          loanStatusFilter === "OVERDUE"
                            ? "bg-red-600 text-white shadow-2xs"
                            : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                        }`}
                      >
                        Overdue ({loanCounts.overdue})
                      </button>
                    )}

                    {loanCounts.extended > 0 && (
                      <button
                        type="button"
                        onClick={() => setLoanStatusFilter("EXTENDED")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          loanStatusFilter === "EXTENDED"
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                        }`}
                      >
                        Extended ({loanCounts.extended})
                      </button>
                    )}
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={loanSearchQuery}
                      onChange={(e) => setLoanSearchQuery(e.target.value)}
                      placeholder="Search borrower, code, dept..."
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    {loanSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setLoanSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {filteredLoanHistoryRows.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl space-y-2">
                    <p className="font-bold text-slate-700 text-sm">No loan history records found</p>
                    <p className="text-slate-400">
                      {loanSearchQuery || loanStatusFilter !== "ALL"
                        ? "Try clearing your search term or status filter."
                        : "This product has never been issued to an employee yet."}
                    </p>
                    {(loanSearchQuery || loanStatusFilter !== "ALL") && (
                      <button
                        type="button"
                        onClick={() => {
                          setLoanSearchQuery("");
                          setLoanStatusFilter("ALL");
                        }}
                        className="mt-2 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase bg-slate-50/50">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Borrower / Custodian</th>
                          <th className="py-2.5 px-3">Issue #</th>
                          <th className="py-2.5 px-3">Action</th>
                          <th className="py-2.5 px-3">Loan Period</th>
                          <th className="py-2.5 px-3">Days</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Remarks</th>
                          <th className="py-2.5 px-3">Actioned By</th>
                          <th className="py-2.5 px-3 text-right">Logged At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredLoanHistoryRows.map((row, idx) => (
                          <tr key={row.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 block">{row.employeeName}</span>
                                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60">
                                  {row.employeeCode}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 block">{row.employeeDepartment}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-700">
                              {row.issueNumber}
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-800">
                              {row.action}
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              <span>{row.fromDate}</span>
                              <span className="text-slate-400 mx-1">→</span>
                              <span className="font-semibold">{row.toDate}</span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-800">{row.days}d</td>
                            <td className="py-3 px-3">
                              <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${row.statusColor}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 max-w-[200px] truncate" title={row.remarks}>
                              {row.remarks}
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-medium">{row.actionedBy}</td>
                            <td className="py-3 px-3 text-right text-slate-500 font-mono text-[11px] whitespace-nowrap">
                              {row.date}
                            </td>
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
