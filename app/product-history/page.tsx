"use client";

import { useEffect, useState, useMemo } from "react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import { History, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/app/components/AuthProvider";

type HistoryEntry = {
  _id: string;
  productId: string;
  action: "CREATED" | "UPDATED" | "DELETED";
  changedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  changedFields?: string[];
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  createdAt: string;
};

export default function ProductHistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDeleteHistory() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/product-history/${deleteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDeleteId(null);
        void fetchHistory();
      } else {
        alert(data.message || "Failed to delete history record");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting history record");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function fetchHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      params.set("page", String(currentPage));
      params.set("limit", String(pageSize));

      const response = await fetch(`/api/product-history?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setHistory(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotalItems(result.pagination.total);
      }
    } catch (error) {
      console.error("Failed to fetch product history:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchHistory();
  }, [actionFilter, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [actionFilter, pageSize]);

  const actionBadgeClass = (action: string) => {
    switch (action) {
      case "CREATED":
        return "bg-emerald-50 text-emerald-700";
      case "UPDATED":
        return "bg-blue-50 text-blue-700";
      case "DELETED":
        return "bg-red-50 text-red-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const formatValue = (value: unknown) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50 p-3 md:p-4 lg:p-5 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
            Product History
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track all product changes, updates, and deletions
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 md:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Change Log ({totalItems})
            </h2>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-full sm:w-auto"
              >
                <option value="">All Actions</option>
                <option value="CREATED">Created</option>
                <option value="UPDATED">Updated</option>
                <option value="DELETED">Deleted</option>
              </select>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
              <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading history...
            </div>
          )}

          {!loading && history.length > 0 && (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Action</th>
                      <th className="px-5 py-3">Product ID</th>
                      <th className="px-5 py-3">Changed By</th>
                      <th className="px-5 py-3">Changed Fields</th>
                      <th className="px-5 py-3">Details</th>
                      {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry._id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-5 py-3 text-slate-600">
                          {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${actionBadgeClass(entry.action)}`}>
                            {entry.action}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-600">
                          {entry.productId}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {entry.changedBy?.name || "-"}
                          {entry.changedBy?.email && (
                            <span className="block text-xs text-slate-400">{entry.changedBy.email}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {entry.changedFields?.map((field) => (
                              <span key={field} className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                {field}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <details className="cursor-pointer">
                            <summary className="text-xs font-medium text-blue-600 hover:text-blue-800">
                              View Details
                            </summary>
                            <div className="mt-2 space-y-2 text-xs">
                              {entry.oldValues && (
                                <div>
                                  <p className="font-semibold text-slate-500">Old Values:</p>
                                  <pre className="mt-1 rounded bg-slate-50 p-2 overflow-x-auto text-slate-700">
                                    {JSON.stringify(entry.oldValues, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {entry.newValues && (
                                <div>
                                  <p className="font-semibold text-slate-500">New Values:</p>
                                  <pre className="mt-1 rounded bg-slate-50 p-2 overflow-x-auto text-slate-700">
                                    {JSON.stringify(entry.newValues, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </details>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setDeleteId(entry._id)}
                              className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
                              title="Delete Record"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 lg:hidden">
                {history.map((entry) => (
                  <div key={entry._id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-800">
                          {entry.action}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${actionBadgeClass(entry.action)}`}>
                        {entry.action}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      <p>Product ID: {entry.productId}</p>
                      <p>By: {entry.changedBy?.name || "-"}</p>
                    </div>
                    {entry.changedFields && entry.changedFields.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.changedFields.map((field) => (
                          <span key={field} className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {field}
                          </span>
                        ))}
                      </div>
                    )}
                    {isAdmin && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setDeleteId(entry._id)}
                          className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 inline-flex items-center gap-1 cursor-pointer transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && history.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">
              No product history found
            </div>
          )}
        </div>

        {!loading && history.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(s) => setPageSize(s)}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        )}
        {/* Delete Confirmation Modal for Admin */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-red-600">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete History Log</h3>
                  <p className="text-xs text-slate-500">Admin Authorization Required</p>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                Are you sure you want to delete this product history audit log? This cannot be undone.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  disabled={deleteLoading}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteHistory}
                  disabled={deleteLoading}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {deleteLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {deleteLoading ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
