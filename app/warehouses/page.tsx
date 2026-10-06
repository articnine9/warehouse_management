"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { Tag, Box, Eye, Warehouse as WarehouseIcon, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import WarningPopup from "@/app/components/WarningPopup";
import WarehouseDetailsModal from "@/app/components/WarehouseDetailsModal";
import RackDetailsModal from "@/app/components/RackDetailsModal";
import AddWarehouseModal from "@/app/components/AddWarehouseModal";

type Warehouse = {
  _id: string;
  name: string;
  code: string;
  address?: string;
  status: "ACTIVE" | "INACTIVE";
  productCount?: number;
  totalUnits?: number;
  rackCount?: number;
};

export default function WarehousesPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Modal inspection state
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [selectedRackId, setSelectedRackId] = useState<string | null>(null);

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Warehouses</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage company warehouse locations and capacity ({warehouses.length} total warehouses)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" /> Add Warehouse
          </button>
        </div>

        {/* Modal for adding warehouse */}
        <AddWarehouseModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => void fetchWarehouses()}
        />

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
                    <th className="px-5 py-3">Warehouse Name</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Address</th>
                    <th className="px-5 py-3">Racks</th>
                    <th className="px-5 py-3">Inventory Products</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedWarehouses.map((warehouse) => (
                    <tr
                      key={warehouse._id}
                      onClick={() => setSelectedWarehouseId(warehouse._id)}
                      className="border-t border-slate-100 hover:bg-blue-50/40 transition cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <div className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 group">
                          <WarehouseIcon className="h-4 w-4 text-blue-500 shrink-0 group-hover:scale-110 transition" />
                          <span>{warehouse.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {warehouse.code}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{warehouse.address || "-"}</td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700"
                          title="Total racks in this warehouse"
                        >
                          <Box className="h-3 w-3" /> {warehouse.rackCount ?? 0} Racks
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700"
                          title="Total product types in this warehouse"
                        >
                          <Tag className="h-3 w-3" /> {warehouse.productCount ?? 0} Products
                          {warehouse.totalUnits !== undefined && warehouse.totalUnits > 0 && (
                            <span className="text-[10px] text-blue-500 font-normal">
                              ({warehouse.totalUnits}u)
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          warehouse.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {warehouse.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWarehouseId(warehouse._id);
                            }}
                            className="rounded-lg border border-blue-200 bg-blue-50/50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition flex items-center gap-1 cursor-pointer"
                            title="View warehouse details & racks"
                          >
                            <Eye className="h-3.5 w-3.5" /> Details
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(warehouse);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(warehouse._id);
                            }}
                            className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 cursor-pointer"
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
                <div
                  key={warehouse._id}
                  onClick={() => setSelectedWarehouseId(warehouse._id)}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2.5 cursor-pointer hover:border-blue-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-blue-600 text-sm">
                        {warehouse.name}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 font-mono font-semibold">{warehouse.code}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                      warehouse.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {warehouse.status}
                    </span>
                  </div>
                  {warehouse.address && (
                    <p className="text-xs text-slate-500">{warehouse.address}</p>
                  )}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                      <Box className="h-3 w-3" /> {warehouse.rackCount ?? 0} Racks
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                      <Tag className="h-3 w-3" /> {warehouse.productCount ?? 0} Products
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWarehouseId(warehouse._id);
                      }}
                      className="flex-1 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition flex items-center justify-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" /> Details & Racks
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(warehouse);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(warehouse._id);
                      }}
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

      {/* Warehouse Details Inspection Modal */}
      <WarehouseDetailsModal
        warehouseId={selectedWarehouseId}
        onClose={() => setSelectedWarehouseId(null)}
        onEditWarehouse={(wh) => {
          setSelectedWarehouseId(null);
          openEdit(wh as Warehouse);
        }}
        onSelectRack={(rackId) => {
          setSelectedRackId(rackId);
        }}
        onAddRack={() => {
          router.push("/racks");
        }}
      />

      {/* Rack Details Inspection Modal */}
      <RackDetailsModal
        rackId={selectedRackId}
        onClose={() => setSelectedRackId(null)}
        onSelectWarehouse={(whId) => {
          setSelectedRackId(null);
          setSelectedWarehouseId(whId);
        }}
      />

      <WarningPopup
        open={warningOpen}
        message={warningMessage}
        onClose={() => setWarningOpen(false)}
      />
    </ProtectedPage>
  );
}
