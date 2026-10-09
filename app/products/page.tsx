"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { FolderTree, History, Warehouse as WarehouseIcon, Plus } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import Pagination from "@/app/components/Pagination";
import Link from "next/link";
import WarningPopup from "@/app/components/WarningPopup";
import AddProductModal from "@/app/components/AddProductModal";
import AddCategoryModal from "@/app/components/AddCategoryModal";
import ProductHistoryModal from "@/app/components/ProductHistoryModal";
import {
  CUSTOM_INTERVAL_VALUE,
  normalizeIntervalMonths,
} from "@/lib/serviceCycle";

type ProductLocation = {
  warehouseId: string;
  warehouseName: string;
  rackId: string;
  rackName: string;
  quantity: number;
};

type Product = {
  _id: string;
  name: string;
  sku: string;
  category?: string;
  serviceIntervalMonths?: number;
  warrantyMonths?: number;
  serialNumber?: string;
  sellerName?: string;
  price?: number;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  totalStock?: number;
  locations?: ProductLocation[];
  createdAt?: string;
  updatedAt?: string;
};

type Category = {
  _id: string;
  name: string;
  code: string;
};

type Warehouse = {
  _id: string;
  name: string;
  code: string;
};

type Rack = {
  _id: string;
  name: string;
  code: string;
  warehouseId: string | { _id: string; name: string; code: string };
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editServiceInterval, setEditServiceInterval] = useState("3");
  const [editCustomServiceInterval, setEditCustomServiceInterval] = useState("");
  const [editWarrantyMonths, setEditWarrantyMonths] = useState("12");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSellerName, setEditSellerName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editLoading, setEditLoading] = useState(false);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);

  async function fetchProducts() {
    try {
      setLoading(true);
      const response = await fetch("/api/products");
      const result = await response.json();
      if (result.success) {
        setProducts(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const response = await fetch("/api/categories");
      const result = await response.json();
      if (result.success) {
        setCategories(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }

  async function fetchWarehouses() {
    try {
      const response = await fetch("/api/warehouses");
      const result = await response.json();
      if (result.success) {
        setWarehouses(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch warehouses:", error);
    }
  }

  async function fetchRacks() {
    try {
      const response = await fetch("/api/racks");
      const result = await response.json();
      if (result.success) {
        setRacks(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch racks:", error);
    }
  }

  useEffect(() => {
    void fetchProducts();
    void fetchCategories();
    void fetchWarehouses();
    void fetchRacks();
  }, []);

  // Category select options
  const categoryOptions: SelectOption[] = useMemo(() => {
    return categories.map((c) => ({
      value: c.name,
      label: c.name,
      subLabel: c.code,
    }));
  }, [categories]);

  const filterCategoryOptions: SelectOption[] = useMemo(() => {
    return [
      { value: "ALL", label: "All Categories" },
      ...categories.map((c) => ({
        value: c.name,
        label: c.name,
        subLabel: c.code,
      })),
    ];
  }, [categories]);

  const filterWarehouseOptions: SelectOption[] = useMemo(() => {
    return [
      { value: "ALL", label: "All Warehouses" },
      ...warehouses.map((w) => ({
        value: w.name,
        label: w.name,
        subLabel: w.code,
      })),
    ];
  }, [warehouses]);


  function openEdit(product: Product) {
    setEditId(product._id);
    setEditName(product.name);
    setEditSku(product.sku);
    setEditCategory(product.category || "");
    const interval = product.serviceIntervalMonths ?? 3;
    const isPreset = [1, 3, 6, 12, 0].includes(interval);
    setEditServiceInterval(isPreset ? String(interval) : CUSTOM_INTERVAL_VALUE);
    setEditCustomServiceInterval(isPreset ? "" : String(interval));
    setEditWarrantyMonths(product.warrantyMonths?.toString() ?? "12");
    setEditSerialNumber(product.serialNumber || "");
    setEditDescription(product.description || "");
    setEditSellerName(product.sellerName || "");
    setEditPrice(product.price?.toString() || "");
    setEditStatus(product.status);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId) return;
    setEditLoading(true);

    const intervalVal = normalizeIntervalMonths(
      editServiceInterval === CUSTOM_INTERVAL_VALUE ? editCustomServiceInterval : editServiceInterval
    );

    try {
      const response = await fetch(`/api/products/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          sku: editSku,
          category: editCategory,
          serviceIntervalMonths: intervalVal,
          warrantyMonths: Math.max(0, Number(editWarrantyMonths) || 0),
          serialNumber: editSerialNumber.trim() || undefined,
          sellerName: editSellerName,
          price: Number(editPrice),
          description: editDescription,
          status: editStatus,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to update product");
        setWarningOpen(true);
        return;
      }
      setEditId(null);
      await fetchProducts();
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
      const response = await fetch(`/api/products/${deleteId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to delete product");
        setWarningOpen(true);
        return;
      }
      setDeleteId(null);
      await fetchProducts();
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesCategory =
        selectedCategoryFilter === "ALL" || p.category === selectedCategoryFilter;

      const matchesWarehouse =
        selectedWarehouseFilter === "ALL" ||
        (p.locations &&
          p.locations.some(
            (loc) =>
              loc.warehouseName.toLowerCase() === selectedWarehouseFilter.toLowerCase()
          ));

      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.sellerName && p.sellerName.toLowerCase().includes(q)) ||
        (p.locations &&
          p.locations.some(
            (loc) =>
              loc.warehouseName.toLowerCase().includes(q) ||
              loc.rackName.toLowerCase().includes(q)
          ));

      return matchesCategory && matchesWarehouse && matchesSearch;
    });
  }, [products, selectedCategoryFilter, selectedWarehouseFilter, searchQuery]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryFilter, selectedWarehouseFilter, searchQuery, pageSize]);

  // Paginated records
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
              Products
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your product catalog and categories ({products.length} total products)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition"
            >
              <Plus className="h-4 w-4" /> Add Product
            </button>
            <Link
              href="/categories"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 self-start sm:self-auto"
            >
              <FolderTree className="h-4 w-4" /> Manage Categories
            </Link>
            <Link
              href="/product-history"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 self-start sm:self-auto"
            >
              <History className="h-4 w-4" /> Product History
            </Link>
          </div>
        </div>

        {/* Category overview cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div
            onClick={() => setSelectedCategoryFilter("ALL")}
            className={`cursor-pointer rounded-2xl border p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 ${
              selectedCategoryFilter === "ALL"
                ? "bg-blue-50/95 border-2 border-blue-500 ring-4 ring-blue-500/20 shadow-xs scale-[1.01]"
                : "bg-blue-50/35 border-blue-200/80 hover:bg-blue-50/70 hover:border-blue-300"
            }`}
          >
            <p className="text-[11px] font-bold tracking-wider text-blue-900/80 uppercase">ALL</p>
            <p className="mt-1 text-sm font-bold text-blue-950">All Categories</p>
            <p className="mt-1 text-2xl font-black text-blue-700">
              {products.length}
            </p>
          </div>

          {categories.map((cat, idx) => {
            const count = products.filter((p) => p.category === cat.name).length;
            const isSelected = selectedCategoryFilter === cat.name;

            const palettes = [
              {
                base: "bg-indigo-50/35 border-indigo-200/80 hover:bg-indigo-50/70 hover:border-indigo-300",
                active: "bg-indigo-50/95 border-2 border-indigo-500 ring-4 ring-indigo-500/20 shadow-xs scale-[1.01]",
                code: "text-indigo-900/80",
                name: "text-indigo-950",
                count: "text-indigo-700",
              },
              {
                base: "bg-emerald-50/35 border-emerald-200/80 hover:bg-emerald-50/70 hover:border-emerald-300",
                active: "bg-emerald-50/95 border-2 border-emerald-500 ring-4 ring-emerald-500/20 shadow-xs scale-[1.01]",
                code: "text-emerald-900/80",
                name: "text-emerald-950",
                count: "text-emerald-700",
              },
              {
                base: "bg-purple-50/35 border-purple-200/80 hover:bg-purple-50/70 hover:border-purple-300",
                active: "bg-purple-50/95 border-2 border-purple-500 ring-4 ring-purple-500/20 shadow-xs scale-[1.01]",
                code: "text-purple-900/80",
                name: "text-purple-950",
                count: "text-purple-700",
              },
              {
                base: "bg-amber-50/35 border-amber-200/80 hover:bg-amber-50/70 hover:border-amber-300",
                active: "bg-amber-50/95 border-2 border-amber-500 ring-4 ring-amber-500/20 shadow-xs scale-[1.01]",
                code: "text-amber-900/80",
                name: "text-amber-950",
                count: "text-amber-700",
              },
              {
                base: "bg-cyan-50/35 border-cyan-200/80 hover:bg-cyan-50/70 hover:border-cyan-300",
                active: "bg-cyan-50/95 border-2 border-cyan-500 ring-4 ring-cyan-500/20 shadow-xs scale-[1.01]",
                code: "text-cyan-900/80",
                name: "text-cyan-950",
                count: "text-cyan-700",
              },
              {
                base: "bg-rose-50/35 border-rose-200/80 hover:bg-rose-50/70 hover:border-rose-300",
                active: "bg-rose-50/95 border-2 border-rose-500 ring-4 ring-rose-500/20 shadow-xs scale-[1.01]",
                code: "text-rose-900/80",
                name: "text-rose-950",
                count: "text-rose-700",
              },
            ];

            const theme = palettes[idx % palettes.length];

            return (
              <div
                key={cat._id}
                onClick={() =>
                  setSelectedCategoryFilter(isSelected ? "ALL" : cat.name)
                }
                className={`cursor-pointer rounded-2xl border p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 ${
                  isSelected ? theme.active : theme.base
                }`}
              >
                <p className={`text-[11px] font-bold tracking-wider uppercase truncate ${theme.code}`}>
                  {cat.code}
                </p>
                <p className={`mt-1 text-sm font-bold truncate ${theme.name}`}>
                  {cat.name}
                </p>
                <p className={`mt-1 text-2xl font-black ${theme.count}`}>
                  {count}
                </p>
              </div>
            );
          })}
        </div>

        {/* Add Product Modal */}
        <AddProductModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          categories={categories}
          warehouses={warehouses}
          racks={racks}
          onSuccess={() => void fetchProducts()}
          onCategoriesChanged={() => void fetchCategories()}
          onWarehousesChanged={() => void fetchWarehouses()}
          onRacksChanged={() => void fetchRacks()}
        />

        {/* Product list */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 md:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Product List ({filteredProducts.length})
              </h2>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Search input in list */}
              <input
                type="text"
                placeholder="Search product, SKU, warehouse, rack..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-full sm:w-56"
              />

              {/* Warehouse Filter */}
              <div className="w-full sm:w-44">
                <SearchableSelect
                  options={filterWarehouseOptions}
                  value={selectedWarehouseFilter}
                  onChange={(val) => setSelectedWarehouseFilter(val || "ALL")}
                  placeholder="All Warehouses"
                  allowClear={false}
                />
              </div>

              {/* Category Filter */}
              <div className="w-full sm:w-44">
                <SearchableSelect
                  options={filterCategoryOptions}
                  value={selectedCategoryFilter}
                  onChange={(val) => setSelectedCategoryFilter(val || "ALL")}
                  placeholder="All Categories"
                  allowClear={false}
                />
              </div>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading products...
            </div>
          )}

          {/* Desktop table */}
          {!loading && paginatedProducts.length > 0 && (
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Storage & Stock</th>
                    <th className="px-5 py-3">Seller</th>
                    <th className="px-5 py-3">Price</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => (
                    <tr
                      key={product._id}
                      className="border-t border-slate-100 hover:bg-slate-50/50"
                    >
                      <td className="px-5 py-3 font-medium text-slate-800">
                        <button
                          type="button"
                          onClick={() => setHistoryProductId(product._id)}
                          className="font-bold text-slate-800 hover:text-blue-600 hover:underline transition text-left block"
                          title="Click to view full product details & loan status"
                        >
                          {product.name}
                        </button>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">{product.sku}</td>
                      <td className="px-5 py-3">
                        {product.category ? (
                          <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {product.category}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {product.locations && product.locations.length > 0 ? (
                          <div className="space-y-1.5 py-0.5">
                            {/* All warehouse location entries */}
                            <div className="space-y-1">
                              {product.locations.map((loc, locIdx) => (
                                <div
                                  key={`${loc.warehouseId}-${loc.rackId}-${locIdx}`}
                                  className="flex items-center gap-1.5 flex-wrap"
                                >
                                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200/70 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                    <WarehouseIcon className="h-3 w-3 text-blue-600 shrink-0" />
                                    {loc.warehouseName}
                                  </span>
                                  <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 text-[11px] font-mono text-slate-700">
                                    Rack: {loc.rackName}
                                  </span>
                                  <span className="inline-flex items-center font-bold text-xs text-slate-800">
                                    • {loc.quantity} {loc.quantity === 1 ? "unit" : "units"}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Stock summary across all warehouses */}
                            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap">
                              <span
                                className={`text-xs font-bold ${
                                  (product.totalStock ?? 0) === 0
                                    ? "text-red-600"
                                    : (product.totalStock ?? 0) <= 10
                                    ? "text-amber-600"
                                    : "text-emerald-700"
                                }`}
                              >
                                Total: {product.totalStock ?? 0} in stock
                              </span>
                              {product.locations.length > 1 && (
                                <span className="rounded-full bg-purple-50 border border-purple-200 px-1.5 py-0.2 text-[10px] font-bold text-purple-700">
                                  {product.locations.length} Warehouses
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-xs text-slate-400 italic block">No rack assigned</span>
                            <Link
                              href={`/inventory?productId=${product._id}`}
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-0.5"
                            >
                              + Assign in Inventory
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {product.sellerName || "-"}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {product.price != null
                          ? `₹${product.price.toLocaleString("en-IN")}`
                          : "-"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            product.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(product)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteId(product._id)}
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

          {/* Mobile / tablet cards */}
          {!loading && paginatedProducts.length > 0 && (
            <div className="space-y-3 p-4 lg:hidden">
              {paginatedProducts.map((product) => (
                <div
                  key={product._id}
                  className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setHistoryProductId(product._id)}
                        className="font-bold text-slate-800 text-left hover:text-blue-600 hover:underline transition block"
                        title="Click to view full product details & loan status"
                      >
                        {product.name}
                      </button>
                      <p className="mt-0.5 text-xs font-mono text-slate-500">SKU: {product.sku}</p>
                    </div>
                    <span
                      className={`ml-2 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        product.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {product.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200/50">
                    <span>
                      Seller: <b>{product.sellerName || "-"}</b>
                    </span>
                    <span className="font-bold text-slate-800">
                      {product.price != null ? `₹${product.price.toLocaleString("en-IN")}` : "-"}
                    </span>
                  </div>

                  <div className="text-xs pt-2 border-t border-slate-200/50 space-y-1.5">
                    <div className="flex items-center justify-between text-slate-500 font-medium">
                      <span>Storage Locations:</span>
                      <span
                        className={`font-bold ${
                          (product.totalStock ?? 0) === 0
                            ? "text-red-600"
                            : (product.totalStock ?? 0) <= 10
                            ? "text-amber-600"
                            : "text-emerald-700"
                        }`}
                      >
                        Total: {product.totalStock ?? 0} units
                        {product.locations && product.locations.length > 1 && (
                          <span className="ml-1 text-[10px] text-purple-700 font-semibold">
                            ({product.locations.length} warehouses)
                          </span>
                        )}
                      </span>
                    </div>

                    {product.locations && product.locations.length > 0 ? (
                      <div className="space-y-1">
                        {product.locations.map((loc, lIdx) => (
                          <div
                            key={lIdx}
                            className="flex items-center justify-between bg-white rounded-md border border-slate-200/70 px-2 py-1"
                          >
                            <span className="font-semibold text-blue-700 flex items-center gap-1">
                              <WarehouseIcon className="h-3 w-3 shrink-0" />
                              {loc.warehouseName}
                            </span>
                            <span className="text-slate-600">
                              Rack: <b className="font-mono text-slate-800">{loc.rackName}</b> •{" "}
                              <b className="text-slate-800">{loc.quantity} units</b>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <Link
                          href={`/inventory?productId=${product._id}`}
                          className="text-blue-600 font-semibold hover:underline"
                        >
                          + Assign Rack
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => openEdit(product)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(product._id)}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No products found */}
          {!loading && filteredProducts.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">
              No products found matching your search.
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredProducts.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredProducts.length}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(s) => setPageSize(s)}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          )}
        </div>

        {/* Edit modal */}
        {editId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-800">Edit Product</h3>
              <form onSubmit={handleEditSubmit} className="mt-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Product Name</label>
                  <input
                    type="text"
                    placeholder="Product name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">SKU</label>
                  <input
                    type="text"
                    placeholder="SKU"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Category</label>
                  <SearchableSelect
                    options={categoryOptions}
                    value={editCategory}
                    onChange={setEditCategory}
                    placeholder="Search category..."
                    onAddNew={() => setIsEditCategoryModalOpen(true)}
                    addNewLabel="Add Category"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Seller Name</label>
                  <input
                    type="text"
                    placeholder="Seller name"
                    value={editSellerName}
                    onChange={(e) => setEditSellerName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Price (₹)</label>
                  <input
                    type="number"
                    placeholder="Price"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    required
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
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
              <h3 className="text-lg font-semibold text-red-600">
                Delete Product
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to delete this product? This action cannot be
                undone.
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

      <WarningPopup
        open={warningOpen}
        message={warningMessage}
        onClose={() => setWarningOpen(false)}
      />

      <AddCategoryModal
        isOpen={isEditCategoryModalOpen}
        onClose={() => setIsEditCategoryModalOpen(false)}
        onSuccess={(newCat) => {
          void fetchCategories();
          setEditCategory(newCat.name);
        }}
        zIndex="z-[70]"
      />

      {historyProductId && (
        <ProductHistoryModal
          productId={historyProductId}
          onClose={() => setHistoryProductId(null)}
          backLabel="Back to Products"
        />
      )}
    </ProtectedPage>
  );
}
