"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Search, X } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import { useAuth } from "@/app/components/AuthProvider";

type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  warehouse: { id: string; name: string; code: string; address?: string } | null;
};

type StaffInventoryItem = {
  id: string;
  productName: string;
  sku: string;
  category: string;
  price: number | null;
  sellerName: string;
  rackName: string;
  rackCode: string;
  quantity: number;
  status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
  warehouseName: string;
  warehouseCode: string;
};

type WarehouseSummary = {
  totalUnits: number;
  distinctProducts: number;
  availableCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  attentionCount: number;
};

function StaffContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialStatusParam = searchParams.get("status") || "ALL";

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffStock, setStaffStock] = useState<StaffInventoryItem[]>([]);
  const [summary, setSummary] = useState<WarehouseSummary | null>(null);
  const [warehouseInfo, setWarehouseInfo] = useState<{ name: string; code: string; address?: string } | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>(
    initialStatusParam === "attention" ? "ATTENTION" : initialStatusParam
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const param = searchParams.get("status");
    if (param === "attention") {
      setStatusFilter("ATTENTION");
    } else if (param) {
      setStatusFilter(param);
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchStaffView() {
      try {
        setLoading(true);
        const response = await fetch("/api/staff", { cache: "no-store" });
        const result = await response.json();
        if (!result.success) return;

        if (result.role === "ADMIN") {
          setStaff(result.data || []);
          return;
        }

        setStaffStock(result.data.items || []);
        setSummary(result.data.summary || null);
        setWarehouseInfo(result.data.warehouse || null);
      } catch (error) {
        console.error("Failed to fetch staff page:", error);
      } finally {
        setLoading(false);
      }
    }
    void fetchStaffView();
  }, []);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/staff/${deleteId}`, { method: "DELETE" });
      const result = await response.json();
      if (!result.success) {
        alert(result.message);
        return;
      }
      setDeleteId(null);
      setStaff(staff.filter((member) => member.id !== deleteId));
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    } finally {
      setDeleteLoading(false);
    }
  }

  function statusBadge(status: string) {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "LOW_STOCK":
        return "bg-amber-50 text-amber-700 border border-amber-200";
      default:
        return "bg-red-50 text-red-700 border border-red-200";
    }
  }

  // Filtered items for staff
  const filteredStaffStock = staffStock.filter((item) => {
    let matchesStatus = true;
    if (statusFilter === "AVAILABLE") matchesStatus = item.status === "AVAILABLE";
    else if (statusFilter === "LOW_STOCK") matchesStatus = item.status === "LOW_STOCK";
    else if (statusFilter === "OUT_OF_STOCK") matchesStatus = item.status === "OUT_OF_STOCK";
    else if (statusFilter === "ATTENTION")
      matchesStatus = item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK";

    let matchesSearch = true;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      matchesSearch =
        item.productName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.sellerName.toLowerCase().includes(q) ||
        item.rackName.toLowerCase().includes(q) ||
        item.rackCode.toLowerCase().includes(q);
    }

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
      {user?.role === "ADMIN" ? (
        <>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Staff Management</h1>
            <p className="mt-1 text-sm text-slate-500">
              Registered staff accounts and their warehouse assignments ({staff.length} staff members)
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-4 md:px-6">
              <h2 className="text-lg font-semibold text-slate-800">Team Members</h2>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Assigned Warehouse</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-800">{member.name}</td>
                      <td className="px-5 py-3 text-slate-500">{member.email}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            member.role === "ADMIN" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {member.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {member.warehouse ? (
                          <div>
                            <span className="font-semibold text-slate-800">{member.warehouse.name}</span>
                            <span className="ml-1 text-xs text-slate-400">({member.warehouse.code})</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {member.role === "STAFF" && (
                          <button
                            onClick={() => setDeleteId(member.id)}
                            className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {staff.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                        No staff users found yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 p-4 md:hidden">
              {staff.map((member) => (
                <div key={member.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{member.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{member.email}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        member.role === "ADMIN" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {member.role}
                    </span>
                  </div>
                  {member.warehouse && (
                    <p className="mt-2 text-xs text-slate-600">
                      Warehouse: <b>{member.warehouse.name}</b> ({member.warehouse.code})
                    </p>
                  )}
                  {member.role === "STAFF" && (
                    <div className="mt-3">
                      <button
                        onClick={() => setDeleteId(member.id)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {staff.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">No staff users found yet.</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Staff Warehouse Overview */}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">My Warehouse Stock</h1>
            <p className="text-sm text-slate-500">
              {warehouseInfo
                ? `${warehouseInfo.name} (${warehouseInfo.code}) — ${warehouseInfo.address || "Warehouse Hub"}`
                : user?.warehouse
                ? `${user.warehouse.name} (${user.warehouse.code})`
                : "Your warehouse stock overview"}
            </p>
          </div>

          {/* Metric Overview Cards for Staff */}
          {summary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`text-left rounded-xl border p-3.5 shadow-sm transition ${
                  statusFilter === "ALL"
                    ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold text-slate-500">TOTAL UNITS</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Total Stock</p>
                <p className="mt-1 text-xl font-extrabold text-blue-600">{summary.totalUnits}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{summary.distinctProducts} products</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("AVAILABLE")}
                className={`text-left rounded-xl border p-3.5 shadow-sm transition ${
                  statusFilter === "AVAILABLE"
                    ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold text-emerald-600">AVAILABLE</p>
                <p className="mt-1 text-sm font-bold text-slate-800">In Stock</p>
                <p className="mt-1 text-xl font-extrabold text-emerald-600">{summary.availableCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">ready to dispatch</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("LOW_STOCK")}
                className={`text-left rounded-xl border p-3.5 shadow-sm transition ${
                  statusFilter === "LOW_STOCK"
                    ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold text-amber-600">LOW STOCK</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Low (&le;10)</p>
                <p className="mt-1 text-xl font-extrabold text-amber-600">{summary.lowStockCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">need refill</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("OUT_OF_STOCK")}
                className={`text-left rounded-xl border p-3.5 shadow-sm transition ${
                  statusFilter === "OUT_OF_STOCK"
                    ? "border-red-500 bg-red-50/50 ring-2 ring-red-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold text-red-600">EMPTY</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Out of Stock</p>
                <p className="mt-1 text-xl font-extrabold text-red-600">{summary.outOfStockCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">0 quantity</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("ATTENTION")}
                className={`text-left rounded-xl border p-3.5 shadow-sm transition col-span-2 sm:col-span-1 ${
                  statusFilter === "ATTENTION"
                    ? "border-amber-600 bg-amber-50 ring-2 ring-amber-600/30"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> ATTENTION
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">Low & Out</p>
                <p className="mt-1 text-xl font-extrabold text-amber-700">{summary.attentionCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">critical items</p>
              </button>
            </div>
          )}

          {/* Attention Alert Banner */}
          {summary && summary.attentionCount > 0 && statusFilter !== "ATTENTION" && (
            <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    {summary.attentionCount} items need attention in this warehouse!
                  </p>
                  <p className="text-xs text-amber-700">
                    {summary.lowStockCount} low stock and {summary.outOfStockCount} out of stock products require restocking.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusFilter("ATTENTION")}
                className="self-start rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700 sm:self-auto"
              >
                Show {summary.attentionCount} Attention Items &rarr;
              </button>
            </div>
          )}

          {/* Attention Active Banner */}
          {statusFilter === "ATTENTION" && (
            <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-100/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <Search className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    Filtering: Showing only {filteredStaffStock.length} Attention Items (Low Stock & Out of Stock)
                  </p>
                  <p className="text-xs text-amber-700">
                    These items are running out or currently empty in your warehouse.
                  </p>
                </div>
              </div>
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className="self-start rounded-lg border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-bold text-amber-900 shadow-sm transition hover:bg-amber-50 sm:self-auto inline-flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Show All Stock ({staffStock.length})
                </button>
            </div>
          )}

          {/* Full Warehouse Inventory List */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-4 md:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {statusFilter === "ATTENTION"
                    ? <span className="inline-flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Attention Items ({filteredStaffStock.length})</span>
                    : `Stock Inventory (${filteredStaffStock.length})`}
                </h2>
                {statusFilter !== "ALL" && (
                  <p className="text-xs text-blue-600 mt-0.5 font-medium">
                    Filter: {statusFilter.replace("_", " ")}
                    <button
                      type="button"
                      onClick={() => setStatusFilter("ALL")}
                      className="ml-2 text-slate-400 hover:text-slate-700 underline"
                    >
                      Reset to All
                    </button>
                  </p>
                )}
              </div>

              {/* Search in stock */}
              <input
                type="text"
                placeholder="Search product, SKU, rack, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-full sm:w-64"
              />
            </div>

            {loading && (
              <div className="p-8 text-center text-sm text-slate-500">Loading warehouse inventory...</div>
            )}

            {/* Desktop table */}
            {!loading && (
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3">SKU</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Price</th>
                      <th className="px-5 py-3">Rack Location</th>
                      <th className="px-5 py-3">Quantity</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaffStock.map((item) => {
                      const isLowOrOut = item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK";

                      return (
                        <tr
                          key={item.id}
                          className={`border-t border-slate-100 transition ${
                            isLowOrOut
                              ? item.status === "OUT_OF_STOCK"
                                ? "bg-red-50/30 hover:bg-red-50/60"
                                : "bg-amber-50/30 hover:bg-amber-50/60"
                              : "hover:bg-slate-50/50"
                          }`}
                        >
                          <td className="px-5 py-3 font-medium text-slate-800">
                            {item.productName}
                            {item.sellerName && item.sellerName !== "-" && (
                              <span className="block text-xs text-slate-400 font-normal">
                                Seller: {item.sellerName}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-slate-500">{item.sku}</td>
                          <td className="px-5 py-3">
                            {item.category && item.category !== "-" ? (
                              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                                {item.category}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-800">
                            {item.price != null ? `₹${item.price.toLocaleString("en-IN")}` : "-"}
                          </td>
                          <td className="px-5 py-3 text-slate-600 font-medium">
                            {item.rackName}{" "}
                            <span className="text-xs text-slate-400 font-normal">({item.rackCode})</span>
                          </td>
                          <td className="px-5 py-3 font-bold text-slate-900">
                            <span className={item.quantity === 0 ? "text-red-600" : item.quantity <= 10 ? "text-amber-600" : ""}>
                              {item.quantity}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(item.status)}`}>
                              {item.status.replace("_", " ")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStaffStock.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400">
                          No inventory items found matching your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile cards */}
            {!loading && (
              <div className="space-y-3 p-4 md:hidden">
                {filteredStaffStock.map((item) => {
                  const isLowOrOut = item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK";

                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-4 transition ${
                        isLowOrOut
                          ? item.status === "OUT_OF_STOCK"
                            ? "border-red-200 bg-red-50/40"
                            : "border-amber-200 bg-amber-50/40"
                          : "border-slate-100 bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">{item.productName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{item.sku}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(item.status)}`}>
                          {item.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                        {item.category && item.category !== "-" && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                            {item.category}
                          </span>
                        )}
                        {item.price != null && (
                          <span className="font-semibold text-slate-800">₹{item.price.toLocaleString("en-IN")}</span>
                        )}
                        <span>
                          Rack: <b>{item.rackName}</b> ({item.rackCode})
                        </span>
                        <span className={`font-bold ${item.quantity === 0 ? "text-red-600" : item.quantity <= 10 ? "text-amber-600" : "text-slate-800"}`}>
                          Qty: {item.quantity}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {filteredStaffStock.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">No inventory records found</p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete modal for admin */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-red-600">Delete Staff</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete this staff member? This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffPage() {
  return (
    <ProtectedPage>
      <Suspense fallback={<div className="min-h-screen bg-slate-50 p-8 text-center text-slate-500">Loading...</div>}>
        <StaffContent />
      </Suspense>
    </ProtectedPage>
  );
}
