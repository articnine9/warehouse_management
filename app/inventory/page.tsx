"use client";

import { FormEvent, useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, RotateCcw } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import Pagination from "@/app/components/Pagination";
import WarningPopup from "@/app/components/WarningPopup";

type Product = {
  _id: string;
  name: string;
  sku: string;
  category?: string;
  price?: number;
  productType?: "REUSABLE" | "NON_REUSABLE";
  returnDays?: number;
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

  // Filtering state
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusParam);
  const [productTypeFilter, setProductTypeFilter] = useState<string>("ALL");
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
      setTimeout(() => {
        const el = document.getElementById("inventory-form-container");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        const qtyInput = document.getElementById("inventory-qty-input");
        if (qtyInput) {
          qtyInput.focus();
        }
      }, 350);
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

      // Product Type Filter (Reusable vs Normal)
      let matchesType = true;
      if (productTypeFilter === "REUSABLE") {
        matchesType = item.productId?.productType === "REUSABLE";
      } else if (productTypeFilter === "NON_REUSABLE") {
        matchesType = item.productId?.productType !== "REUSABLE";
      }

      return matchesStatus && matchesWarehouse && matchesSearch && matchesType;
    });
  }, [inventory, statusFilter, selectedWarehouseFilter, searchQuery, productTypeFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, selectedWarehouseFilter, searchQuery, productTypeFilter, pageSize]);

  // Paginated records
  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInventory.slice(start, start + pageSize);
  }, [filteredInventory, currentPage, pageSize]);

  const inputCls =
    "rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Inventory</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage and track product stock distribution across all warehouses and racks ({inventory.length} total entries)
        </p>
      </div>

      {/* Stock Status Filter Cards */}
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
          <p className="text-xs font-semibold text-slate-500">ALL</p>
          <p className="mt-1 text-sm font-bold text-slate-800">All Stock</p>
          <p className="mt-1 text-xl font-extrabold text-blue-600">{inventory.length}</p>
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
          <p className="text-xs font-semibold text-emerald-600">IN STOCK</p>
          <p className="mt-1 text-sm font-bold text-slate-800">Available</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-600">{availableCount}</p>
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
          <p className="mt-1 text-xl font-extrabold text-amber-600">{lowStockCount}</p>
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
          <p className="mt-1 text-xl font-extrabold text-red-600">{outOfStockCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("LOW_OUT")}
          className={`text-left rounded-xl border p-3.5 shadow-sm transition col-span-2 sm:col-span-1 ${
            statusFilter === "LOW_OUT"
              ? "border-amber-600 bg-amber-50 ring-2 ring-amber-600/20"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <p className="text-xs font-semibold text-amber-700">ATTENTION</p>
          <p className="mt-1 text-sm font-bold text-slate-800">Low & Out</p>
          <p className="mt-1 text-xl font-extrabold text-amber-700">{lowOutCount}</p>
        </button>
      </div>

      {/* Add inventory form */}
      <div id="inventory-form-container" className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
          <h2 className="text-lg font-semibold text-slate-800">
            {searchParams.get("restock") ? "Restock Product Stock" : "Add Stock to Location"}
          </h2>
          {searchParams.get("restock") && (
            <span className="rounded-full bg-amber-100 text-amber-900 px-2.5 py-0.5 text-xs font-bold w-fit">
              Restock Action Active
            </span>
          )}
        </div>

        {/* Quick Restock Alert Banner */}
        {/* {searchParams.get("restock") && (
          <div className="mb-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200 p-3.5 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-extrabold uppercase tracking-wide text-amber-900">Restock Mode:</span>{" "}
                Product, Warehouse & Rack have been <b>automatically pre-filled</b>. Enter the incoming quantity below to restock!
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setProductId("");
                setWarehouseId("");
                setRackId("");
                setQuantity("");
              }}
              className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950 shrink-0"
            >
              Clear Pre-fill
            </button>
          </div>
        )} */}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Product</label>
            <SearchableSelect
              options={productOptions}
              value={productId}
              onChange={setProductId}
              placeholder="Search & select product..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Warehouse</label>
            <SearchableSelect
              options={warehouseOptions}
              value={warehouseId}
              onChange={(wId) => {
                setWarehouseId(wId);
                setRackId("");
              }}
              placeholder="Search & select warehouse..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Rack Location</label>
            <SearchableSelect
              options={rackOptions}
              value={rackId}
              onChange={setRackId}
              placeholder={warehouseId ? "Search & select rack..." : "Select warehouse first"}
              disabled={!warehouseId}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              {searchParams.get("restock") ? "Quantity to Add (Restock Units)" : "Quantity"}
            </label>
            <input
              id="inventory-qty-input"
              type="number"
              min="1"
              placeholder={searchParams.get("restock") ? "Enter restock quantity (e.g. 50)" : "Quantity"}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className={`w-full ${inputCls}`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`h-[42px] rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50 ${
              searchParams.get("restock")
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading
              ? "Saving..."
              : searchParams.get("restock")
              ? "+ Add Restocked Units"
              : "+ Add Stock Entry"}
          </button>
        </form>
      </div>

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
            {/* Product Type Filter Toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setProductTypeFilter("ALL")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  productTypeFilter === "ALL"
                    ? "bg-white text-slate-800 shadow-2xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                All ({inventory.length})
              </button>
              <button
                type="button"
                onClick={() => setProductTypeFilter("REUSABLE")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1 ${
                  productTypeFilter === "REUSABLE"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <RotateCcw className="h-3 w-3" /> Reusable ({inventory.filter((i) => i.productId?.productType === "REUSABLE").length})
              </button>
              <button
                type="button"
                onClick={() => setProductTypeFilter("NON_REUSABLE")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  productTypeFilter === "NON_REUSABLE"
                    ? "bg-white text-slate-800 shadow-2xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Normal ({inventory.filter((i) => i.productId?.productType !== "REUSABLE").length})
              </button>
            </div>

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
                  <th className="px-5 py-3">Type</th>
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
                      {item.productId?.name || "Unknown"}{" "}
                      <span className="text-xs text-slate-400">({item.productId?.sku || "-"})</span>
                    </td>
                    <td className="px-5 py-3">
                      {item.productId?.productType === "REUSABLE" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-bold text-indigo-700">
                          <RotateCcw className="h-2.5 w-2.5" /> Reusable ({item.productId?.returnDays || 30}d)
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          Normal
                        </span>
                      )}
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(item._id)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Delete
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
                      <p className="font-semibold text-slate-800">{item.productId?.name || "Unknown"}</p>
                      {item.productId?.productType === "REUSABLE" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.2 text-[10px] font-bold text-indigo-700">
                          <RotateCcw className="h-2.5 w-2.5" /> Reusable ({item.productId?.returnDays || 30}d)
                        </span>
                      )}
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
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openEdit(item)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteId(item._id)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Delete
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
