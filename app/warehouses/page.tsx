"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { Tag } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import WarningPopup from "@/app/components/WarningPopup";

type Warehouse = {
  _id: string;
  name: string;
  code: string;
  address?: string;
  status: "ACTIVE" | "INACTIVE";
  productCount?: number;
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editLoading, setEditLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  async function fetchWarehouses() {
    try {
      setFetching(true);
      const response = await fetch("/api/warehouses");
      const result = await response.json();

      if (result.success) {
        setWarehouses(result.data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    void fetchWarehouses();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/warehouses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          code,
          address,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to add warehouse");
        setWarningOpen(true);
        return;
      }

      setName("");
      setCode("");
      setAddress("");
      await fetchWarehouses();
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(warehouse: Warehouse) {
    setEditId(warehouse._id);
    setEditName(warehouse.name);
    setEditCode(warehouse.code);
    setEditAddress(warehouse.address || "");
    setEditStatus(warehouse.status);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId) return;
    setEditLoading(true);

    try {
      const response = await fetch(`/api/warehouses/${editId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editName,
          code: editCode,
          address: editAddress,
          status: editStatus,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to update warehouse");
        setWarningOpen(true);
        return;
      }

      setEditId(null);
      await fetchWarehouses();
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
      const response = await fetch(`/api/warehouses/${deleteId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to delete warehouse");
        setWarningOpen(true);
        return;
      }

      setDeleteId(null);
      await fetchWarehouses();
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredWarehouses = useMemo(() => {
    if (!searchQuery.trim()) return warehouses;
    const q = searchQuery.toLowerCase().trim();
    return warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q) ||
        (w.address && w.address.toLowerCase().includes(q))
    );
  }, [warehouses, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const paginatedWarehouses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWarehouses.slice(start, start + pageSize);
  }, [filteredWarehouses, currentPage, pageSize]);

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Warehouses</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage company warehouse locations and capacity ({warehouses.length} total warehouses)
          </p>
        </div>

        {/* Add warehouse form */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Add Warehouse</h2>

          <form
            onSubmit={handleSubmit}
            className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 items-end"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Warehouse Name</label>
              <input
                type="text"
                placeholder="e.g. Chennai Central Hub"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Warehouse Code</label>
              <input
                type="text"
                placeholder="e.g. WH-01"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Address (Optional)</label>
              <input
                type="text"
                placeholder="Address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-[42px] rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Adding..." : "+ Add Warehouse"}
            </button>
          </form>
        </div>

        {/* Warehouse list */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 md:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Warehouse List ({filteredWarehouses.length})
            </h2>

            <input
              type="text"
              placeholder="Search warehouse name, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-full sm:w-64"
            />
          </div>

          {/* Loading state */}
          {fetching && (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
              <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading warehouses...
            </div>
          )}

          {/* Desktop table */}
          {!fetching && paginatedWarehouses.length > 0 && (
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Address</th>
                    <th className="px-5 py-3">Products</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedWarehouses.map((warehouse) => (
                    <tr key={warehouse._id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-800">{warehouse.name}</td>
                      <td className="px-5 py-3 text-slate-600">{warehouse.code}</td>
                      <td className="px-5 py-3 text-slate-500">{warehouse.address || "-"}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          <Tag className="h-3 w-3" /> {warehouse.productCount ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          warehouse.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {warehouse.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(warehouse)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteId(warehouse._id)}
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
          {!fetching && paginatedWarehouses.length > 0 && (
            <div className="space-y-3 p-4 md:hidden">
              {paginatedWarehouses.map((warehouse) => (
                <div key={warehouse._id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{warehouse.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{warehouse.code}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      warehouse.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {warehouse.status}
                    </span>
                  </div>
                  {warehouse.address && (
                    <p className="mt-2 text-xs text-slate-500">{warehouse.address}</p>
                  )}
                  <div className="mt-2 flex items-center gap-1 text-xs text-slate-600">
                    <Tag className="h-3 w-3" /> Products: {warehouse.productCount ?? 0}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openEdit(warehouse)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(warehouse._id)}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!fetching && filteredWarehouses.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">
              No warehouses found.
            </div>
          )}

          {/* Pagination */}
          {!fetching && filteredWarehouses.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredWarehouses.length}
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
            <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-800">Edit Warehouse</h3>
              <form onSubmit={handleEditSubmit} className="mt-5 space-y-3">
                <input
                  type="text"
                  placeholder="Warehouse name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="text"
                  placeholder="Warehouse code"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
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
              <h3 className="text-lg font-semibold text-red-600">Delete Warehouse</h3>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to delete this warehouse? This action cannot be undone.
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
