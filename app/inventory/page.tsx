"use client";

import { FormEvent, useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Pencil, Eye, Trash2, Printer, X, Box, Plus } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import Pagination from "@/app/components/Pagination";
import WarningPopup from "@/app/components/WarningPopup";
import ProductHistoryModal from "@/app/components/ProductHistoryModal";
import AddInventoryModal from "@/app/components/AddInventoryModal";

type Product = {
  _id: string;
  name: string;
  sku: string;
  category?: string;
  price?: number;
};
type Warehouse = { _id: string; name: string; code: string };
type Rack = { _id: string; name: string; code: string; warehouseId: { _id: string; name: string; code: string } };
type Inventory = {
  _id: string;
  productId: Product;
  warehouseId: Warehouse;
  rackId: Rack;
  quantity: number;
  status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
};

function InventoryContent() {
  const searchParams = useSearchParams();
  const initialStatusParam = searchParams.get("status") || "ALL";

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filtering state
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusParam);
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form states
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [rackId, setRackId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Edit / Delete states
  const [editId, setEditId] = useState<string | null>(null);
  const [editProductId, setEditProductId] = useState("");
  const [editWarehouseId, setEditWarehouseId] = useState("");
  const [editRackId, setEditRackId] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Product History and Stock Voucher Modals
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [viewingStockItem, setViewingStockItem] = useState<Inventory | null>(null);

  async function fetchProducts() {
    const r = await fetch("/api/products");
    const d = await r.json();
    if (d.success) setProducts(d.data || []);
  }

  async function fetchWarehouses() {
    const r = await fetch("/api/warehouses");
    const d = await r.json();
    if (d.success) setWarehouses(d.data || []);
  }

  async function fetchRacks() {
    const r = await fetch("/api/racks");
    const d = await r.json();
    if (d.success) setRacks(d.data || []);
  }

  async function fetchInventory() {
    try {
      setFetching(true);
      const r = await fetch("/api/inventory");
      const d = await r.json();
      if (d.success) setInventory(d.data || []);
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    const param = searchParams.get("status");
    if (param) {
      setStatusFilter(param);
    }

    const pParam = searchParams.get("productId");
    const wParam = searchParams.get("warehouseId");
    const rParam = searchParams.get("rackId");
    const isRestock = searchParams.get("restock");

    if (pParam) setProductId(pParam);
    if (wParam) setWarehouseId(wParam);
    if (rParam) setRackId(rParam);

    if (pParam || wParam || isRestock) {
      setIsAddModalOpen(true);
    }
  }, [searchParams, products, warehouses, racks]);

  useEffect(() => {
    void fetchProducts();
    void fetchWarehouses();
    void fetchRacks();
    void fetchInventory();
  }, []);

  const filteredRacks = useMemo(() => {
    if (!warehouseId) return [];
    return racks.filter((rack) => {
      const wId = typeof rack.warehouseId === "object" && rack.warehouseId ? rack.warehouseId._id : rack.warehouseId;
      return String(wId) === String(warehouseId);
    });
  }, [racks, warehouseId]);

  const editFilteredRacks = useMemo(() => {
    if (!editWarehouseId) return [];
    return racks.filter((rack) => {
      const wId = typeof rack.warehouseId === "object" && rack.warehouseId ? rack.warehouseId._id : rack.warehouseId;
      return String(wId) === String(editWarehouseId);
    });
  }, [racks, editWarehouseId]);

  // Searchable Select Options
  const productOptions: SelectOption[] = useMemo(() => {
    return products.map((p) => ({
      value: p._id,
      label: p.name,
      subLabel: `SKU: ${p.sku}`,
      badge: p.price != null ? `₹${p.price.toLocaleString("en-IN")}` : undefined,
    }));
  }, [products]);

  const warehouseOptions: SelectOption[] = useMemo(() => {
    return warehouses.map((w) => ({
      value: w._id,
      label: w.name,
      subLabel: w.code,
    }));
  }, [warehouses]);

  const filterWarehouseOptions: SelectOption[] = useMemo(() => {
    return [
      { value: "ALL", label: "All Warehouses" },
      ...warehouses.map((w) => ({
        value: w._id,
        label: w.name,
        subLabel: w.code,
      })),
    ];
  }, [warehouses]);

  const rackOptions: SelectOption[] = useMemo(() => {
    return filteredRacks.map((r) => ({
      value: r._id,
      label: r.name,
      subLabel: r.code,
    }));
  }, [filteredRacks]);

  const editRackOptions: SelectOption[] = useMemo(() => {
    return editFilteredRacks.map((r) => ({
      value: r._id,
      label: r.name,
      subLabel: r.code,
    }));
  }, [editFilteredRacks]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productId || !warehouseId || !rackId) {
      setWarningMessage("Please select product, warehouse, and rack");
      setWarningOpen(true);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          warehouseId,
          rackId,
          quantity: Number(quantity),
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to add inventory");
        setWarningOpen(true);
        return;
      }
      setProductId("");
      setWarehouseId("");
      setRackId("");
      setQuantity("");
      await fetchInventory();
    } catch (error) {
      console.error("Failed to create inventory:", error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(item: Inventory) {
    setEditId(item._id);
    setEditProductId(item.productId?._id || "");
    setEditWarehouseId(item.warehouseId?._id || "");
    setEditRackId(item.rackId?._id || "");
    setEditQuantity(item.quantity.toString());
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId || !editProductId || !editWarehouseId || !editRackId) {
      setWarningMessage("Please select product, warehouse, and rack");
      setWarningOpen(true);
      return;
    }
    setEditLoading(true);
    try {
      const response = await fetch(`/api/inventory/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editProductId,
          warehouseId: editWarehouseId,
          rackId: editRackId,
          quantity: Number(editQuantity),
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to update inventory");
        setWarningOpen(true);
        return;
      }
      setEditId(null);
      await fetchInventory();
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/inventory/${deleteId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to delete inventory");
        setWarningOpen(true);
        return;
      }
      setDeleteId(null);
      await fetchInventory();
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  }

  function statusBadge(status: string) {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-50 text-emerald-700";
      case "LOW_STOCK":
        return "bg-amber-50 text-amber-700";
      default:
        return "bg-red-50 text-red-700";
    }
  }

  // Counts for status cards
  const availableCount = inventory.filter((i) => i.status === "AVAILABLE").length;
  const lowStockCount = inventory.filter((i) => i.status === "LOW_STOCK").length;
  const outOfStockCount = inventory.filter((i) => i.status === "OUT_OF_STOCK").length;
  const lowOutCount = lowStockCount + outOfStockCount;

  // Filtered inventory list
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      // Status Filter
      let matchesStatus = true;
      if (statusFilter === "AVAILABLE") matchesStatus = item.status === "AVAILABLE";
      else if (statusFilter === "LOW_STOCK") matchesStatus = item.status === "LOW_STOCK";
      else if (statusFilter === "OUT_OF_STOCK") matchesStatus = item.status === "OUT_OF_STOCK";
      else if (statusFilter === "LOW_OUT")
        matchesStatus = item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK";

      // Warehouse Filter
      let matchesWarehouse = true;
      if (selectedWarehouseFilter !== "ALL") {
        matchesWarehouse = item.warehouseId?._id === selectedWarehouseFilter;
      }

      // Search Query
      let matchesSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pName = item.productId?.name?.toLowerCase() || "";
        const pSku = item.productId?.sku?.toLowerCase() || "";
        const wName = item.warehouseId?.name?.toLowerCase() || "";
        const rName = item.rackId?.name?.toLowerCase() || "";
        const rCode = item.rackId?.code?.toLowerCase() || "";
        matchesSearch =
          pName.includes(q) ||
          pSku.includes(q) ||
          wName.includes(q) ||
          rName.includes(q) ||
          rCode.includes(q);
      }

      return matchesStatus && matchesWarehouse && matchesSearch;
    });
  }, [inventory, statusFilter, selectedWarehouseFilter, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, selectedWarehouseFilter, searchQuery, pageSize]);

  // Paginated records
  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInventory.slice(start, start + pageSize);
  }, [filteredInventory, currentPage, pageSize]);

  const inputCls =
    "rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage and track product stock distribution across all warehouses and racks ({inventory.length} total entries)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Add Stock Entry
        </button>
      </div>

      {/* Stock Status Filter Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
            statusFilter === "ALL"
              ? "bg-blue-50/95 border-2 border-blue-500 ring-4 ring-blue-500/20 shadow-xs scale-[1.01]"
              : "bg-blue-50/35 border-blue-200/80 hover:bg-blue-50/70 hover:border-blue-300"
          }`}
        >
          <p className="text-[11px] font-bold tracking-wider text-blue-900/80 uppercase">ALL</p>
          <p className="mt-1 text-sm font-bold text-blue-950">All Stock</p>
          <p className="mt-1 text-2xl font-black text-blue-700">{inventory.length}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("AVAILABLE")}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
            statusFilter === "AVAILABLE"
              ? "bg-emerald-50/95 border-2 border-emerald-500 ring-4 ring-emerald-500/20 shadow-xs scale-[1.01]"
              : "bg-emerald-50/35 border-emerald-200/80 hover:bg-emerald-50/70 hover:border-emerald-300"
          }`}
        >
          <p className="text-[11px] font-bold tracking-wider text-emerald-900/80 uppercase">IN STOCK</p>
          <p className="mt-1 text-sm font-bold text-emerald-950">Available</p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{availableCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("LOW_STOCK")}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
            statusFilter === "LOW_STOCK"
              ? "bg-amber-50/95 border-2 border-amber-500 ring-4 ring-amber-500/20 shadow-xs scale-[1.01]"
              : "bg-amber-50/35 border-amber-200/80 hover:bg-amber-50/70 hover:border-amber-300"
          }`}
        >
          <p className="text-[11px] font-bold tracking-wider text-amber-900/80 uppercase">LOW STOCK</p>
          <p className="mt-1 text-sm font-bold text-amber-950">Low (&le;10)</p>
          <p className="mt-1 text-2xl font-black text-amber-700">{lowStockCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("OUT_OF_STOCK")}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
            statusFilter === "OUT_OF_STOCK"
              ? "bg-red-50/95 border-2 border-red-500 ring-4 ring-red-500/20 shadow-xs scale-[1.01]"
              : "bg-red-50/35 border-red-200/80 hover:bg-red-50/70 hover:border-red-300"
          }`}
        >
          <p className="text-[11px] font-bold tracking-wider text-red-900/80 uppercase">EMPTY</p>
          <p className="mt-1 text-sm font-bold text-red-950">Out of Stock</p>
          <p className="mt-1 text-2xl font-black text-red-700">{outOfStockCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("LOW_OUT")}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 cursor-pointer col-span-2 sm:col-span-1 ${
            statusFilter === "LOW_OUT"
              ? "bg-rose-50/95 border-2 border-rose-500 ring-4 ring-rose-500/20 shadow-xs scale-[1.01]"
              : "bg-rose-50/35 border-rose-200/80 hover:bg-rose-50/70 hover:border-rose-300"
          }`}
        >
          <p className="text-[11px] font-bold tracking-wider text-rose-900/80 uppercase">ATTENTION</p>
          <p className="mt-1 text-sm font-bold text-rose-950">Low & Out</p>
          <p className="mt-1 text-2xl font-black text-rose-700">{lowOutCount}</p>
        </button>
      </div>

      {/* Modal for adding inventory / restock */}
      <AddInventoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        products={products}
        warehouses={warehouses}
        racks={racks}
        defaultProductId={productId}
        defaultWarehouseId={warehouseId}
        defaultRackId={rackId}
        isRestock={Boolean(searchParams.get("restock"))}
        onSuccess={() => void fetchInventory()}
        onProductsChanged={() => void fetchProducts()}
        onWarehousesChanged={() => void fetchWarehouses()}
        onRacksChanged={() => void fetchRacks()}
      />

      {/* Inventory list */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-4 md:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Inventory Records ({filteredInventory.length})
            </h2>
            {statusFilter !== "ALL" && (
              <p className="text-xs text-blue-600 mt-0.5 font-medium">
                Filtering by: {statusFilter.replace("_", " ")}
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className="ml-2 text-slate-400 hover:text-slate-700 underline"
                >
                  Clear filter
                </button>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search input in list */}
            <input
              type="text"
              placeholder="Search product, rack, warehouse..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-full sm:w-56"
            />

            {/* Warehouse Filter */}
            <div className="w-full sm:w-48">
              <SearchableSelect
                options={filterWarehouseOptions}
                value={selectedWarehouseFilter}
                onChange={(val) => setSelectedWarehouseFilter(val || "ALL")}
                placeholder="All Warehouses"
                allowClear={false}
              />
            </div>
          </div>
        </div>

        {/* Loading state */}
        {fetching && (
          <div className="p-8 text-center text-sm text-slate-500">Loading inventory records...</div>
        )}

        {/* Desktop table */}
        {!fetching && paginatedInventory.length > 0 && (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Warehouse</th>
                  <th className="px-5 py-3">Rack</th>
                  <th className="px-5 py-3">Quantity</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInventory.map((item) => (
                  <tr key={item._id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-800">
                      <button
                        type="button"
                        onClick={() => setHistoryProductId(item.productId?._id || null)}
                        className="font-semibold text-slate-800 hover:text-blue-600 hover:underline transition text-left block"
                        title="Click to view complete product history"
                      >
                        {item.productId?.name || "Unknown"}
                      </button>
                      <span className="text-xs text-slate-400">({item.productId?.sku || "-"})</span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{item.warehouseId?.name || "-"}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {item.rackId?.name || "-"}{" "}
                      <span className="text-xs text-slate-400">({item.rackId?.code || "-"})</span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{item.quantity}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(item.status)}`}>
                        {item.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 transition shadow-2xs active:scale-95"
                          title="Update Stock Entry"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewingStockItem(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 transition shadow-2xs active:scale-95"
                          title="View Stock Voucher / Slip"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(item._id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-red-500 hover:bg-red-50 hover:text-red-700 transition shadow-2xs active:scale-95"
                          title="Delete Stock Entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile cards */}
        {!fetching && paginatedInventory.length > 0 && (
          <div className="space-y-3 p-4 md:hidden">
            {paginatedInventory.map((item) => (
              <div key={item._id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setHistoryProductId(item.productId?._id || null)}
                        className="font-bold text-slate-800 text-left hover:text-blue-600 hover:underline"
                        title="Click to view complete product history"
                      >
                        {item.productId?.name || "Unknown"}
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{item.productId?.sku || "-"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(item.status)}`}>
                    {item.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Warehouse: {item.warehouseId?.name || "-"}</span>
                  <span>
                    Rack: {item.rackId?.name || "-"} ({item.rackId?.code || "-"})
                  </span>
                  <span className="font-semibold text-slate-700">Qty: {item.quantity}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Update
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingStockItem(item)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                  >
                    <Eye className="h-3.5 w-3.5" /> View Slip
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(item._id)}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium text-red-600 hover:bg-red-50 shadow-2xs active:scale-95"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {!fetching && filteredInventory.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-400">
            No inventory records found matching your filters.
          </div>
        )}

        {/* Pagination Controls */}
        {!fetching && filteredInventory.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredInventory.length}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => setPageSize(size)}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        )}
      </div>

      {/* Edit modal */}
      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Edit Inventory</h3>
            <form onSubmit={handleEditSubmit} className="mt-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Product</label>
                <SearchableSelect
                  options={productOptions}
                  value={editProductId}
                  onChange={setEditProductId}
                  placeholder="Search & select product..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Warehouse</label>
                <SearchableSelect
                  options={warehouseOptions}
                  value={editWarehouseId}
                  onChange={(wId) => {
                    setEditWarehouseId(wId);
                    setEditRackId("");
                  }}
                  placeholder="Search & select warehouse..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Rack Location</label>
                <SearchableSelect
                  options={editRackOptions}
                  value={editRackId}
                  onChange={setEditRackId}
                  placeholder={editWarehouseId ? "Search & select rack..." : "Select warehouse first"}
                  disabled={!editWarehouseId}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Quantity</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Quantity"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  required
                  className={`w-full ${inputCls}`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditId(null)}
                  className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-red-600">Delete Inventory</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete this inventory record? This action cannot be undone.
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
      {/* 🧾 Stock Voucher / Receipt Slip Modal */}
      {viewingStockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl my-auto rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
            {/* Top Bar (Hidden on print) */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-3.5 print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-xs">
                  <Box className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    Stock Receipt & Storage Voucher
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    STK-{viewingStockItem._id.slice(-8).toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const pId = viewingStockItem.productId?._id;
                    setViewingStockItem(null);
                    if (pId) setHistoryProductId(pId);
                  }}
                  className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
                >
                  Full History →
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-2xs active:scale-95"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setViewingStockItem(null)}
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Printable Slip Paper */}
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto bg-white text-slate-900 print:p-0 print:m-0">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-xl font-black text-slate-900 uppercase">
                    Warehouse Inventory Voucher
                  </h1>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    Goods Storage Slip & Rack Allocation Note
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold bg-slate-900 text-white text-xs px-2.5 py-1 rounded">
                    STK-{viewingStockItem._id.slice(-8).toUpperCase()}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Date: {new Date().toLocaleDateString("en-IN")}
                  </p>
                </div>
              </div>

              {/* Grid Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
                  <p className="font-bold uppercase text-[10px] text-slate-500 border-b border-slate-200 pb-1">
                    Storage Location
                  </p>
                  <p className="text-sm font-bold text-slate-900 pt-0.5">
                    {viewingStockItem.warehouseId?.name || "Main Warehouse"}
                  </p>
                  <p className="text-slate-600">
                    Warehouse Code: <b className="text-slate-800">{viewingStockItem.warehouseId?.code || "-"}</b>
                  </p>
                  <p className="text-slate-600">
                    Rack Shelf: <b className="text-slate-800">{viewingStockItem.rackId?.name || "-"}</b> ({viewingStockItem.rackId?.code || "-"})
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
                  <p className="font-bold uppercase text-[10px] text-slate-500 border-b border-slate-200 pb-1">
                    Product Specification
                  </p>
                  <p className="text-sm font-bold text-slate-900 pt-0.5">
                    {viewingStockItem.productId?.name}
                  </p>
                  <p className="text-slate-600">
                    SKU Code: <b className="text-slate-800">{viewingStockItem.productId?.sku}</b>
                  </p>
                  <p className="text-slate-600">
                    Category: <b className="text-slate-800">{viewingStockItem.productId?.category || "General"}</b>
                  </p>
                </div>
              </div>

              {/* Quantities Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-bold uppercase text-[10px] text-slate-700">
                    <tr>
                      <th className="p-3">Quantity Stored</th>
                      <th className="p-3">Stock Status</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Total Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    <tr>
                      <td className="p-3 font-extrabold text-base text-slate-900">
                        {viewingStockItem.quantity} units
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusBadge(viewingStockItem.status)}`}>
                          {viewingStockItem.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-600">
                        {viewingStockItem.productId?.price ? `₹${viewingStockItem.productId.price.toLocaleString("en-IN")}` : "N/A"}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        {viewingStockItem.productId?.price ? `₹${(viewingStockItem.productId.price * viewingStockItem.quantity).toLocaleString("en-IN")}` : "N/A"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="pt-6 grid grid-cols-2 gap-8 border-t border-slate-200">
                <div className="space-y-10">
                  <div className="h-8 border-b border-dashed border-slate-300" />
                  <p className="font-bold text-xs text-slate-700">Storage In-Charge</p>
                </div>
                <div className="space-y-10 text-right">
                  <div className="h-8 border-b border-dashed border-slate-300" />
                  <p className="font-bold text-xs text-slate-700">Warehouse Supervisor</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📦 Top-to-Bottom Product History Modal */}
      {historyProductId && (
        <ProductHistoryModal
          productId={historyProductId}
          onClose={() => setHistoryProductId(null)}
        />
      )}

      <WarningPopup
        open={warningOpen}
        message={warningMessage}
        onClose={() => setWarningOpen(false)}
      />
    </div>
  );
}

export default function InventoryPage() {
  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <Suspense fallback={<div className="min-h-screen bg-slate-50 p-8 text-center text-slate-500">Loading Inventory...</div>}>
        <InventoryContent />
      </Suspense>
    </ProtectedPage>
  );
}
