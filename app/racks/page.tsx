"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { Tag } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import Pagination from "@/app/components/Pagination";
import WarningPopup from "@/app/components/WarningPopup";

type Warehouse = {
  _id: string;
  name: string;
  code: string;
};

type Rack = {
  _id: string;
  name: string;
  code: string;
  warehouseId: {
    _id: string;
    name: string;
    code: string;
  };
  status: "ACTIVE" | "INACTIVE";
  productCount?: number;
};

export default function RacksPage() {
  const [racks, setRacks] = useState<Rack[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editWarehouseId, setEditWarehouseId] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editLoading, setEditLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  async function fetchRacks() {
    try {
      setFetching(true);
      const response = await fetch("/api/racks");
      const result = await response.json();
      if (result.success) setRacks(result.data || []);
    } catch (error) {
      console.error("Failed to fetch racks:", error);
    } finally {
      setFetching(false);
    }
  }

  async function fetchWarehouses() {
    try {
      const response = await fetch("/api/warehouses");
      const result = await response.json();
      if (result.success) setWarehouses(result.data || []);
    } catch (error) {
      console.error("Failed to fetch warehouses:", error);
    }
  }

  useEffect(() => {
    void fetchRacks();
    void fetchWarehouses();
  }, []);

  const warehouseOptions: SelectOption[] = useMemo(() => {
    return warehouses.map((w) => ({
      value: w._id,
      label: w.name,
      subLabel: w.code,
    }));
  }, [warehouses]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!warehouseId) {
      setWarningMessage("Please select a warehouse");
      setWarningOpen(true);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/racks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code, warehouseId }),
      });
      const result = await response.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to add rack");
        setWarningOpen(true);
        return;
      }
      setName("");
      setCode("");
      setWarehouseId("");
      await fetchRacks();
    } catch (error) {
      console.error("Failed to create rack:", error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(rack: Rack) {
    setEditId(rack._id);
    setEditName(rack.name);
    setEditCode(rack.code);
    setEditWarehouseId(rack.warehouseId?._id || "");
    setEditStatus(rack.status);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId || !editWarehouseId) {
      setWarningMessage("Please select a warehouse");
      setWarningOpen(true);
      return;
    }
    setEditLoading(true);
    try {
      const response = await fetch(`/api/racks/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          code: editCode,
          warehouseId: editWarehouseId,
          status: editStatus,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to update rack");
        setWarningOpen(true);
        return;
      }
      setEditId(null);
      await fetchRacks();
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
      const response = await fetch(`/api/racks/${deleteId}`, { method: "DELETE" });
      const result = await response.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to delete rack");
        setWarningOpen(true);
        return;
      }
      setDeleteId(null);
      await fetchRacks();
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredRacks = useMemo(() => {
    if (!searchQuery.trim()) return racks;
    const q = searchQuery.toLowerCase().trim();
    return racks.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.warehouseId?.name && r.warehouseId.name.toLowerCase().includes(q)) ||
        (r.warehouseId?.code && r.warehouseId.code.toLowerCase().includes(q))
    );
  }, [racks, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const paginatedRacks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRacks.slice(start, start + pageSize);
  }, [filteredRacks, currentPage, pageSize]);

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Racks</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage warehouse storage racks and shelf allocations ({racks.length} total racks)
          </p>
        </div>

        {/* Add rack form */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Add Rack</h2>
          <form
            onSubmit={handleSubmit}
            className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 items-end"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Rack Name</label>
              <input
                type="text"
                placeholder="e.g. Aisle 1 - Top Shelf"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Rack Code</label>
              <input
                type="text"
                placeholder="e.g. RACK-A1"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Warehouse</label>
              <SearchableSelect
                options={warehouseOptions}
                value={warehouseId}
                onChange={setWarehouseId}
                placeholder="Search warehouse..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-[42px] rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Adding..." : "+ Add Rack"}
            </button>
          </form>
        </div>

        {/* Rack list */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 md:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Rack List ({filteredRacks.length})
            </h2>

            <input
              type="text"
              placeholder="Search rack name, code, warehouse..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-full sm:w-64"
            />
          </div>

          {/* Loading */}
          {fetching && (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
              <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading racks...
            </div>
          )}

          {/* Desktop table */}
          {!fetching && paginatedRacks.length > 0 && (
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Rack Name</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Warehouse</th>
                    <th className="px-5 py-3">Products</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRacks.map((rack) => (
                    <tr key={rack._id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-800">{rack.name}</td>
                      <td className="px-5 py-3 text-slate-600">{rack.code}</td>
                      <td className="px-5 py-3 text-slate-500">
                        {rack.warehouseId?.name || "-"} ({rack.warehouseId?.code || "-"})
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          <Tag className="h-3 w-3" /> {rack.productCount ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            rack.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {rack.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(rack)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteId(rack._id)}
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
          {!fetching && paginatedRacks.length > 0 && (
            <div className="space-y-3 p-4 md:hidden">
              {paginatedRacks.map((rack) => (
                <div key={rack._id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{rack.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{rack.code}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        rack.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {rack.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Warehouse: {rack.warehouseId?.name || "-"} ({rack.warehouseId?.code || "-"})
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                    <Tag className="h-3 w-3" /> Products: {rack.productCount ?? 0}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openEdit(rack)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(rack._id)}
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
          {!fetching && filteredRacks.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">No racks found</p>
          )}

          {/* Pagination */}
          {!fetching && filteredRacks.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredRacks.length}
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
              <h3 className="text-lg font-semibold text-slate-800">Edit Rack</h3>
              <form onSubmit={handleEditSubmit} className="mt-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Rack Name</label>
                  <input
                    type="text"
                    placeholder="Rack name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Rack Code</label>
                  <input
                    type="text"
                    placeholder="Rack code"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Warehouse</label>
                  <SearchableSelect
                    options={warehouseOptions}
                    value={editWarehouseId}
                    onChange={setEditWarehouseId}
                    placeholder="Search warehouse..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")}
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
              <h3 className="text-lg font-semibold text-red-600">Delete Rack</h3>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to delete this rack? This action cannot be undone.
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
