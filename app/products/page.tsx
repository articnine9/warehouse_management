"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { FolderTree, History, RotateCcw, Box, Tag, Wrench, Shield, Hash } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import Pagination from "@/app/components/Pagination";
import Link from "next/link";
import WarningPopup from "@/app/components/WarningPopup";
import {
  SERVICE_INTERVAL_OPTIONS,
  CUSTOM_INTERVAL_VALUE,
  normalizeIntervalMonths,
  formatServiceInterval,
} from "@/lib/serviceCycle";

type Product = {
  _id: string;
  name: string;
  sku: string;
  category?: string;
  productType?: "REUSABLE" | "NON_REUSABLE";
  returnDays?: number;
  serviceIntervalMonths?: number;
  warrantyMonths?: number;
  serialNumber?: string;
  sellerName?: string;
  price?: number;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: string;
  updatedAt?: string;
};

type Category = {
  _id: string;
  name: string;
  code: string;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<"ALL" | "REUSABLE" | "NON_REUSABLE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [addLoading, setAddLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState<"NON_REUSABLE" | "REUSABLE">("NON_REUSABLE");
  const [returnDays, setReturnDays] = useState("30");
  const [serviceInterval, setServiceInterval] = useState("3");
  const [customServiceInterval, setCustomServiceInterval] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState("12");
  const [serialNumber, setSerialNumber] = useState("");
  const [description, setDescription] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [price, setPrice] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editProductType, setEditProductType] = useState<"NON_REUSABLE" | "REUSABLE">("NON_REUSABLE");
  const [editReturnDays, setEditReturnDays] = useState("30");
  const [editServiceInterval, setEditServiceInterval] = useState("3");
  const [editCustomServiceInterval, setEditCustomServiceInterval] = useState("");
  const [editWarrantyMonths, setEditWarrantyMonths] = useState("12");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSellerName, setEditSellerName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editLoading, setEditLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

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

  useEffect(() => {
    void fetchProducts();
    void fetchCategories();
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddLoading(true);

    const intervalVal = normalizeIntervalMonths(
      serviceInterval === CUSTOM_INTERVAL_VALUE ? customServiceInterval : serviceInterval
    );

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sku,
          category,
          productType,
          returnDays: productType === "REUSABLE" ? Math.max(1, Number(returnDays) || 30) : 0,
          serviceIntervalMonths: intervalVal,
          warrantyMonths: Math.max(0, Number(warrantyMonths) || 0),
          serialNumber: serialNumber.trim() || undefined,
          sellerName,
          price: Number(price),
          description,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to add product");
        setWarningOpen(true);
        return;
      }
      setName("");
      setSku("");
      setCategory("");
      setProductType("NON_REUSABLE");
      setReturnDays("30");
      setServiceInterval("3");
      setCustomServiceInterval("");
      setWarrantyMonths("12");
      setSerialNumber("");
      setSellerName("");
      setPrice("");
      setDescription("");
      await fetchProducts();
    } catch (error) {
      console.error("Failed to create product:", error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setAddLoading(false);
    }
  }

  function openEdit(product: Product) {
    setEditId(product._id);
    setEditName(product.name);
    setEditSku(product.sku);
    setEditCategory(product.category || "");
    setEditProductType(product.productType || "NON_REUSABLE");
    setEditReturnDays(product.returnDays?.toString() || "30");
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
          productType: editProductType,
          returnDays: editProductType === "REUSABLE" ? Math.max(1, Number(editReturnDays) || 30) : 0,
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
    return products.filter((p) => {
      const matchesCategory =
        selectedCategoryFilter === "ALL" || p.category === selectedCategoryFilter;
      const matchesType =
        selectedTypeFilter === "ALL" ||
        (selectedTypeFilter === "REUSABLE" ? p.productType === "REUSABLE" : p.productType !== "REUSABLE");
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (p.sellerName &&
          p.sellerName.toLowerCase().includes(searchQuery.toLowerCase().trim()));
      return matchesCategory && matchesType && matchesSearch;
    });
  }, [products, selectedCategoryFilter, selectedTypeFilter, searchQuery]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryFilter, selectedTypeFilter, searchQuery, pageSize]);

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

        {/* ─── Classification Type Quick Cards (Reusable vs Normal) ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setSelectedTypeFilter("ALL")}
            className={`text-left rounded-xl border p-4 shadow-sm transition ${
              selectedTypeFilter === "ALL"
                ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">All Catalog</span>
              <Box className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-1 text-base font-bold text-slate-800">Total Products</p>
            <p className="mt-1 text-2xl font-extrabold text-blue-600">{products.length}</p>
            <p className="text-[11px] text-slate-500 mt-1">Complete product repository</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTypeFilter("REUSABLE")}
            className={`text-left rounded-xl border p-4 shadow-sm transition ${
              selectedTypeFilter === "REUSABLE"
                ? "border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-800 uppercase">Returnable Assets</span>
              <RotateCcw className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="mt-1 text-base font-bold text-slate-800">Reusable Products</p>
            <p className="mt-1 text-2xl font-extrabold text-indigo-600">
              {products.filter((p) => p.productType === "REUSABLE").length}
            </p>
            <p className="text-[11px] text-indigo-700 font-medium mt-1">Assets / tools with return & renewal tracking</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTypeFilter("NON_REUSABLE")}
            className={`text-left rounded-xl border p-4 shadow-sm transition ${
              selectedTypeFilter === "NON_REUSABLE"
                ? "border-slate-500 bg-slate-100 ring-2 ring-slate-400/20"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase">Standard Items</span>
              <Tag className="h-4 w-4 text-slate-600" />
            </div>
            <p className="mt-1 text-base font-bold text-slate-800">Normal Consumables</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-700">
              {products.filter((p) => p.productType !== "REUSABLE").length}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Standard stock items (No return required)</p>
          </button>
        </div>

        {/* Category overview cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div
            onClick={() => setSelectedCategoryFilter("ALL")}
            className={`cursor-pointer rounded-xl border p-3.5 shadow-sm transition ${
              selectedCategoryFilter === "ALL"
                ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p className="text-xs font-semibold text-slate-500">ALL</p>
            <p className="mt-1 text-sm font-bold text-slate-800">All Categories</p>
            <p className="mt-1 text-xl font-extrabold text-blue-600">
              {products.length}
            </p>
          </div>

          {categories.map((cat) => {
            const count = products.filter((p) => p.category === cat.name).length;
            const isSelected = selectedCategoryFilter === cat.name;

            return (
              <div
                key={cat._id}
                onClick={() =>
                  setSelectedCategoryFilter(isSelected ? "ALL" : cat.name)
                }
                className={`cursor-pointer rounded-xl border p-3.5 shadow-sm transition ${
                  isSelected
                    ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold text-slate-500">{cat.code}</p>
                <p className="mt-1 text-sm font-bold text-slate-800 truncate">
                  {cat.name}
                </p>
                <p className="mt-1 text-xl font-extrabold text-slate-800">
                  {count}
                </p>
              </div>
            );
          })}
        </div>

        {/* Add product form */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Add Product</h2>
          <form
            onSubmit={handleSubmit}
            className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 items-end"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Product Name</label>
              <input
                type="text"
                placeholder="Product name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">SKU Code</label>
              <input
                type="text"
                placeholder="SKU (e.g. LAP001)"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Category</label>
              <SearchableSelect
                options={categoryOptions}
                value={category}
                onChange={setCategory}
                placeholder="Search category..."
              />
            </div>

            {/* Product Type (Reusable vs Normal) */}
            <div className="md:col-span-2 lg:col-span-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200/80">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Product Classification / Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setProductType("NON_REUSABLE")}
                  className={`flex flex-col text-left p-3 rounded-lg border transition ${
                    productType === "NON_REUSABLE"
                      ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Box className="h-4 w-4 text-slate-600" /> Normal / Consumable Item
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    Regular consumable or standard stock item (No return/renewal required).
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setProductType("REUSABLE")}
                  className={`flex flex-col text-left p-3 rounded-lg border transition ${
                    productType === "REUSABLE"
                      ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                    <RotateCcw className="h-4 w-4 text-indigo-600" /> Reusable / Returnable Asset
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    Asset / tool / device requiring return or renewal after specified days.
                  </span>
                </button>
              </div>

              {productType === "REUSABLE" && (
                <div className="mt-3 pt-3 border-t border-slate-200/70">
                  <label className="block text-xs font-bold text-indigo-950 mb-1">
                    Default Return / Renewal Period (in Days) *
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 30"
                      value={returnDays}
                      onChange={(e) => setReturnDays(e.target.value)}
                      required={productType === "REUSABLE"}
                      className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none focus:border-indigo-600"
                    />
                    <span className="text-xs text-slate-500">Days</span>
                    <div className="flex flex-wrap gap-1.5 ml-2">
                      {[7, 15, 30, 60, 90, 180, 365].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setReturnDays(d.toString())}
                          className={`rounded-md px-2 py-1 text-[11px] font-semibold border transition ${
                            returnDays === d.toString()
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    When this product is issued, the holder must return it or renew the period before these days elapse.
                  </p>
                </div>
              )}
            </div>

            {/* Service Interval, Warranty & Serial Number Specification */}
            <div className="md:col-span-2 lg:col-span-3 rounded-xl bg-slate-50/70 p-3.5 border border-slate-200/80 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase">
                <Wrench className="h-3.5 w-3.5 text-blue-600" />
                <span>Service Maintenance, Warranty & Tracking Specs</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Service Interval (Recurring Cycle)
                  </label>
                  <select
                    value={serviceInterval}
                    onChange={(e) => setServiceInterval(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 font-medium text-slate-800"
                  >
                    {SERVICE_INTERVAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option value={CUSTOM_INTERVAL_VALUE}>Custom Months...</option>
                  </select>
                </div>

                {serviceInterval === CUSTOM_INTERVAL_VALUE && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Enter Custom Months
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 2, 4, 9..."
                      value={customServiceInterval}
                      onChange={(e) => setCustomServiceInterval(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Warranty (Months)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 12 (0 for no warranty)"
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Serial No / Asset Tag (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SN-PREFIX / TAG-001"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 font-medium text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Seller Name</label>
              <input
                type="text"
                placeholder="Seller name"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Price (₹)</label>
              <input
                type="number"
                placeholder="Price (₹)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                step="0.01"
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Description (Optional)</label>
              <input
                type="text"
                placeholder="Description (Optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={addLoading}
              className="h-[42px] rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 md:col-span-2 lg:col-span-3"
            >
              {addLoading ? "Adding..." : "+ Add Product"}
            </button>
          </form>
        </div>

        {/* Product list */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 md:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Product List ({filteredProducts.length})
              </h2>
              {selectedTypeFilter !== "ALL" && (
                <p className="text-xs text-blue-600 mt-0.5">
                  Type: {selectedTypeFilter === "REUSABLE" ? "Reusable Products" : "Normal Products"}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Type Filter Buttons */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter("ALL")}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    selectedTypeFilter === "ALL"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  All ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter("REUSABLE")}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    selectedTypeFilter === "REUSABLE"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Reusable ({products.filter((p) => p.productType === "REUSABLE").length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter("NON_REUSABLE")}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    selectedTypeFilter === "NON_REUSABLE"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Normal ({products.filter((p) => p.productType !== "REUSABLE").length})
                </button>
              </div>

              {/* Search input in list */}
              <input
                type="text"
                placeholder="Filter by name, SKU, seller..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-full sm:w-48"
              />

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
                    <th className="px-5 py-3">Type / Validity</th>
                    <th className="px-5 py-3">Service Interval</th>
                    <th className="px-5 py-3">Warranty & Serial</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Category</th>
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
                        {product.name}
                      </td>
                      <td className="px-5 py-3">
                        {product.productType === "REUSABLE" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                            <RotateCcw className="h-3 w-3" /> Reusable ({product.returnDays || 30}d)
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          <Wrench className="h-3 w-3 text-blue-600" />
                          {formatServiceInterval(product.serviceIntervalMonths)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <Shield className="h-3 w-3 text-emerald-600" />
                            {product.warrantyMonths ? `${product.warrantyMonths}m Warranty` : "No Warranty"}
                          </span>
                          {product.serialNumber && (
                            <span className="text-[11px] font-mono text-slate-500 flex items-center gap-0.5">
                              <Hash className="h-2.5 w-2.5" /> {product.serialNumber}
                            </span>
                          )}
                        </div>
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
                      <p className="font-semibold text-slate-800">
                        {product.name}
                      </p>
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

                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {product.productType === "REUSABLE" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-bold text-indigo-700">
                        <RotateCcw className="h-3 w-3" /> Reusable ({product.returnDays || 30}d)
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                        Normal
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      <Wrench className="h-3 w-3" />
                      {formatServiceInterval(product.serviceIntervalMonths)}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <Shield className="h-3 w-3" />
                      {product.warrantyMonths ? `${product.warrantyMonths}m Warranty` : "No Warranty"}
                    </span>

                    {product.serialNumber && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-mono text-purple-700">
                        <Hash className="h-3 w-3" />
                        {product.serialNumber}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200/50">
                    <span>
                      Seller: <b>{product.sellerName || "-"}</b>
                    </span>
                    <span className="font-bold text-slate-800">
                      {product.price != null ? `₹${product.price.toLocaleString("en-IN")}` : "-"}
                    </span>
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
                  />
                </div>

                {/* Edit Product Type */}
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Product Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditProductType("NON_REUSABLE")}
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-md text-xs font-bold border ${
                        editProductType === "NON_REUSABLE"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-200"
                      }`}
                    >
                      <Box className="h-3.5 w-3.5" /> Normal Item
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditProductType("REUSABLE")}
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-md text-xs font-bold border ${
                        editProductType === "REUSABLE"
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-700 border-slate-200"
                      }`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reusable Asset
                    </button>
                  </div>
                  {editProductType === "REUSABLE" && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200">
                      <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                        Return / Renewal Period (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editReturnDays}
                        onChange={(e) => setEditReturnDays(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold"
                      />
                    </div>
                  )}
                </div>

                {/* Edit Service Interval, Warranty, Serial */}
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-2.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Service & Warranty Specs</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Service Interval
                      </label>
                      <select
                        value={editServiceInterval}
                        onChange={(e) => setEditServiceInterval(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 font-medium"
                      >
                        {SERVICE_INTERVAL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                        <option value={CUSTOM_INTERVAL_VALUE}>Custom Months...</option>
                      </select>
                    </div>

                    {editServiceInterval === CUSTOM_INTERVAL_VALUE && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                          Custom Months
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Months"
                          value={editCustomServiceInterval}
                          onChange={(e) => setEditCustomServiceInterval(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Warranty (Months)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editWarrantyMonths}
                        onChange={(e) => setEditWarrantyMonths(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none font-medium"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Serial Number / Tag
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SN-XXXX"
                        value={editSerialNumber}
                        onChange={(e) => setEditSerialNumber(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none font-medium"
                      />
                    </div>
                  </div>
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
    </ProtectedPage>
  );
}
