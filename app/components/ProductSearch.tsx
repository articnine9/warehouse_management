"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Search, X, Package, Layers, MapPin } from "lucide-react";
import SearchableSelect, { SelectOption } from "./SearchableSelect";
import Pagination from "./Pagination";

type SearchResult = {
  _id: string;
  productId: {
    _id?: string;
    name: string;
    sku: string;
    category?: string;
    sellerName?: string;
    price?: number;
  };
  warehouseId: {
    _id?: string;
    name: string;
    code: string;
  };
  rackId: {
    _id?: string;
    name: string;
    code: string;
  };
  quantity: number;
  status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
};

type Category = {
  _id: string;
  name: string;
  code?: string;
};

export default function ProductSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [inventory, setInventory] = useState<SearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch categories once
  useEffect(() => {
    async function fetchCategories() {
      try {
        const catRes = await fetch("/api/categories");
        const catData = await catRes.json();
        if (catData.success) setCategories(catData.data || []);
      } catch (error) {
        console.error("Failed to load categories:", error);
      }
    }
    void fetchCategories();
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch paginated inventory chunk from server
  const fetchChunk = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(pageSize));

      if (debouncedQuery.trim()) {
        params.set("q", debouncedQuery.trim());
      }
      if (selectedStatus !== "ALL") {
        params.set("status", selectedStatus);
      }
      if (selectedCategory !== "ALL") {
        params.set("category", selectedCategory);
      }

      const res = await fetch(`/api/inventory?${params.toString()}`);
      const result = await res.json();

      if (result.success) {
        setInventory(result.data || []);
        if (result.pagination) {
          setTotalCount(result.pagination.total || 0);
        } else {
          setTotalCount(result.count || (result.data ? result.data.length : 0));
        }
      } else {
        setInventory([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error("Failed to fetch inventory chunk:", error);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedQuery, selectedStatus, selectedCategory]);

  useEffect(() => {
    void fetchChunk();
  }, [fetchChunk]);

  function statusBadgeClass(status: string) {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "LOW_STOCK":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-red-50 text-red-700 border-red-200";
    }
  }

  // Category options for SearchableSelect
  const categoryOptions: SelectOption[] = useMemo(() => {
    const options: SelectOption[] = [{ value: "ALL", label: "All Categories" }];
    categories.forEach((c) => {
      options.push({
        value: c.name,
        label: c.name,
        subLabel: c.code,
      });
    });
    return options;
  }, [categories]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-100 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-800">
                Warehouse Inventory Directory
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Browse, search, and monitor stock locations, racks, and product pricing ({totalCount} total matching items)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Category:</span>
            <div className="w-48">
              <SearchableSelect
                options={categoryOptions}
                value={selectedCategory}
                onChange={(val) => {
                  setSelectedCategory(val || "ALL");
                  setCurrentPage(1);
                }}
                placeholder="All Categories"
                allowClear={false}
              />
            </div>
          </div>
        </div>

        {/* Search & Status Filter Controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* Live Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product name, SKU, seller, warehouse, or rack..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-10 py-2.5 text-sm outline-none transition focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { label: "All", value: "ALL" },
              { label: "Available", value: "AVAILABLE" },
              { label: "Low Stock", value: "LOW_STOCK" },
              { label: "Out of Stock", value: "OUT_OF_STOCK" },
            ].map((status) => (
              <button
                key={status.value}
                type="button"
                onClick={() => {
                  setSelectedStatus(status.value);
                  setCurrentPage(1);
                }}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition shrink-0 ${
                  selectedStatus === status.value
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
          <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading inventory records...
        </div>
      )}

      {/* Desktop Table */}
      {!loading && inventory.length > 0 && (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Product & SKU</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5 text-right">Price</th>
                <th className="px-5 py-3.5">Warehouse</th>
                <th className="px-5 py-3.5">Rack Location</th>
                <th className="px-5 py-3.5 text-center">Stock Qty</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory.map((item) => (
                <tr key={item._id} className="hover:bg-slate-50/70 transition">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-800">
                      {item.productId?.name || "Unknown Product"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>SKU: {item.productId?.sku || "-"}</span>
                      {item.productId?.sellerName && (
                        <>
                          <span>•</span>
                          <span>Seller: {item.productId.sellerName}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {item.productId?.category ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100">
                        <Layers className="h-3 w-3" /> {item.productId.category}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                    {item.productId?.price != null
                      ? `₹${Number(item.productId.price).toLocaleString("en-IN")}`
                      : "-"}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-700">{item.warehouseId?.name || "-"}</p>
                    {item.warehouseId?.code && (
                      <span className="text-xs text-slate-400">({item.warehouseId.code})</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 text-slate-700 font-medium">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{item.rackId?.name || "-"}</span>
                      {item.rackId?.code && (
                        <span className="text-xs text-slate-400">({item.rackId.code})</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-block font-extrabold text-slate-800 text-sm">
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                        item.status
                      )}`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Result Cards */}
      {!loading && inventory.length > 0 && (
        <div className="space-y-3 p-4 md:hidden">
          {inventory.map((item) => (
            <div
              key={item._id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800">{item.productId?.name || "Unknown"}</p>
                  <p className="text-xs text-slate-400">SKU: {item.productId?.sku || "-"}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                    item.status
                  )}`}
                >
                  {item.status.replace("_", " ")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Warehouse & Rack</span>
                  <span className="font-semibold text-slate-800">
                    {item.warehouseId?.code || "-"} • {item.rackId?.name || "-"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase">Stock Qty</span>
                  <span className="font-bold text-slate-900 text-sm">{item.quantity} units</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Category</span>
                  <span className="font-medium text-blue-700">{item.productId?.category || "-"}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase">Unit Price</span>
                  <span className="font-bold text-slate-800">
                    {item.productId?.price != null ? `₹${item.productId.price.toLocaleString("en-IN")}` : "-"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {!loading && inventory.length === 0 && (
        <div className="p-12 text-center text-sm text-slate-400">
          <p className="font-medium text-slate-600">No inventory records found</p>
          <p className="text-xs text-slate-400 mt-1">
            {query
              ? `No records matching "${query}"`
              : "No inventory items have been recorded in this category/status."}
          </p>
        </div>
      )}

      {/* Pagination Footer */}
      {!loading && totalCount > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={totalCount}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      )}
    </div>
  );
}
