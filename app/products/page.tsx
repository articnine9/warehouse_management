"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { FolderTree, History } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import Pagination from "@/app/components/Pagination";
import Link from "next/link";
import WarningPopup from "@/app/components/WarningPopup";

type Product = {
  _id: string;
  name: string;
  sku: string;
  category?: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [addLoading, setAddLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [price, setPrice] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editCategory, setEditCategory] = useState("");
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
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sku,
          category,
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
    setEditDescription(product.description || "");
    setEditSellerName(product.sellerName || "");
    setEditPrice(product.price?.toString() || "");
    setEditStatus(product.status);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId) return;
    setEditLoading(true);
    try {
      const response = await fetch(`/api/products/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          sku: editSku,
          category: editCategory,
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
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (p.sellerName &&
          p.sellerName.toLowerCase().includes(searchQuery.toLowerCase().trim()));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryFilter, searchQuery]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryFilter, searchQuery, pageSize]);

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
            <p className="mt-1 text-sm font-bold text-slate-800">All Products</p>
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
            <h2 className="text-lg font-semibold text-slate-800">
              Product List ({filteredProducts.length})
            </h2>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Search input in list */}
              <input
                type="text"
                placeholder="Filter by name, SKU, seller..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-full sm:w-56"
              />

              {/* Category Filter */}
              <div className="w-full sm:w-48">
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
                    <th className="px-5 py-3">Seller</th>
                    <th className="px-5 py-3">Price</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3">Updated</th>
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
                      <td className="px-5 py-3 text-slate-600">{product.sku}</td>
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
                      <td className="px-5 py-3 text-slate-500">
                        {product.createdAt
                          ? new Date(product.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {product.updatedAt
                          ? new Date(product.updatedAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
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
                  className="rounded-lg border border-slate-100 bg-slate-50/50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">
                        {product.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{product.sku}</p>
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
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {product.category && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                        Category: {product.category}
                      </span>
                    )}
                    {product.sellerName && (
                      <span>Seller: {product.sellerName}</span>
                    )}
                    {product.price != null && (
                      <span className="font-semibold text-slate-700">
                        ₹{product.price.toLocaleString("en-IN")}
                      </span>
                    )}
                    {product.createdAt && (
                      <span>
                        Created: {new Date(product.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {product.updatedAt && product.updatedAt !== product.createdAt && (
                      <span>
                        Updated: {new Date(product.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
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
