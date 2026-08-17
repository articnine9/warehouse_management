"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";

type SearchResult = {
  _id: string;
  productId: {
    name: string;
    sku: string;
    category?: string;
    sellerName?: string;
    price?: number;
  };
  warehouseId: {
    name: string;
    code: string;
  };
  rackId: {
    name: string;
    code: string;
  };
  quantity: number;
  status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
};

type Category = {
  _id: string;
  name: string;
};

export default function ProductSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch("/api/categories");
        const result = await response.json();
        if (result.success) setCategories(result.data);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    }
    void fetchCategories();
  }, []);

  const executeSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/inventory/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      const result = await response.json();

      if (result.success) {
        setResults(result.data || []);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(query);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, executeSearch]);

  const handleManualSearch = () => {
    executeSearch(query);
  };

  function statusBadgeClass(status: string) {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-50 text-emerald-700";
      case "LOW_STOCK":
        return "bg-amber-50 text-amber-700";
      default:
        return "bg-red-50 text-red-700";
    }
  }

  const filteredResults = results.filter((item) => {
    if (selectedCategory === "ALL") return true;
    return item.productId?.category === selectedCategory;
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Product Search</h2>
          <p className="mt-1 text-xs text-slate-500">
            Find product warehouse, rack locations, category, and pricing in real time
          </p>
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by product name or SKU (e.g. Laptop, LAP001)..."
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              if (!value.trim()) {
                setResults([]);
                setHasSearched(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleManualSearch();
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
                setHasSearched(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={handleManualSearch}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-5 flex items-center justify-center gap-2 p-4 text-sm text-slate-500">
          <svg className="h-4 w-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Searching for &ldquo;{query}&rdquo;...
        </div>
      )}

      {/* Desktop results table */}
      {!loading && filteredResults.length > 0 && (
        <>
          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Warehouse</th>
                  <th className="px-4 py-3">Rack</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((item) => (
                  <tr key={item._id} className="border-t border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {item.productId?.name || "Unknown Product"}
                        <span className="ml-2 text-xs text-slate-400">({item.productId?.sku || "-"})</span>
                      </p>
                      {item.productId?.sellerName && (
                        <p className="text-xs text-slate-400">Seller: {item.productId.sellerName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.productId?.category ? (
                        <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {item.productId.category}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {item.productId?.price != null ? `₹${item.productId.price.toLocaleString("en-IN")}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.warehouseId?.name || "-"}
                      {item.warehouseId?.code && <span className="ml-1 text-xs text-slate-400">({item.warehouseId.code})</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.rackId?.name || "-"}
                      {item.rackId?.code && <span className="ml-1 text-xs text-slate-400">({item.rackId.code})</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{item.quantity}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                        {item.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile result cards */}
          <div className="mt-5 space-y-3 md:hidden">
            {filteredResults.map((item) => (
              <div key={item._id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{item.productId?.name || "Unknown"}</p>
                    <p className="text-xs text-slate-400">{item.productId?.sku || "-"}</p>
                  </div>
                  <span className={`ml-2 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                    {item.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {item.productId?.category && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Category: {item.productId.category}
                    </span>
                  )}
                  {item.productId?.price != null && (
                    <span className="font-semibold text-slate-700">₹{item.productId.price.toLocaleString("en-IN")}</span>
                  )}
                  {item.productId?.sellerName && <span>Seller: {item.productId.sellerName}</span>}
                  <span>Warehouse: {item.warehouseId?.name || "-"}</span>
                  <span>Rack: {item.rackId?.name || "-"}</span>
                  <span className="font-semibold text-slate-700">Qty: {item.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* No Results */}
      {!loading && hasSearched && filteredResults.length === 0 && (
        <div className="mt-5 rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-400">
          No products found matching &ldquo;{query}&rdquo;
          {selectedCategory !== "ALL" && ` in category "${selectedCategory}"`}
        </div>
      )}
    </div>
  );
}
