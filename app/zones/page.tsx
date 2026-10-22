"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { Layers, Box, Eye, Warehouse as WarehouseIcon, Plus } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import { useAuth } from "@/app/components/AuthProvider";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import Pagination from "@/app/components/Pagination";
import WarningPopup from "@/app/components/WarningPopup";
import WarehouseDetailsModal from "@/app/components/WarehouseDetailsModal";
import ZoneDetailsModal from "@/app/components/ZoneDetailsModal";
import RackDetailsModal from "@/app/components/RackDetailsModal";
import AddZoneModal from "@/app/components/AddZoneModal";
import AddWarehouseModal from "@/app/components/AddWarehouseModal";

type Warehouse = {
  _id: string;
  name: string;
  code: string;
};

type Zone = {
  _id: string;
  name: string;
  code?: string;
  warehouseId: {
    _id: string;
    name: string;
    code: string;
  };
  status: "ACTIVE" | "INACTIVE";
  rackCount?: number;
};

export default function ZonesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [zones, setZones] = useState<Zone[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddWarehouseModalOpen, setIsAddWarehouseModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Modal inspection state
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [selectedRackId, setSelectedRackId] = useState<string | null>(null);

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

  async function fetchZones() {
    try {
      setFetching(true);
      const response = await fetch("/api/zones");
      const result = await response.json();
      if (result.success) setZones(result.data || []);
    } catch (error) {
      console.error("Failed to fetch zones:", error);
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
    void fetchZones();
    void fetchWarehouses();
  }, []);

  const warehouseOptions: SelectOption[] = useMemo(() => {
    return warehouses.map((w) => ({
      value: w._id,
      label: w.name,
      subLabel: w.code,
    }));
  }, [warehouses]);

  function openEdit(zone: Zone) {
    setEditId(zone._id);
    setEditName(zone.name);
    setEditCode(zone.code || "");
    setEditWarehouseId(zone.warehouseId?._id || "");
    setEditStatus(zone.status);
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
      const response = await fetch(`/api/zones/${editId}`, {
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
        setWarningMessage(result.message || "Failed to update zone");
        setWarningOpen(true);
        return;
      }
      setEditId(null);
      await fetchZones();
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
      const response = await fetch(`/api/zones/${deleteId}`, { method: "DELETE" });
      const result = await response.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to delete zone");
        setWarningOpen(true);
        return;
      }
      setDeleteId(null);
      await fetchZones();
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredZones = useMemo(() => {
    if (!searchQuery.trim()) return zones;
    const q = searchQuery.toLowerCase().trim();
    return zones.filter(
      (z) =>
        z.name.toLowerCase().includes(q) ||
        (z.code && z.code.toLowerCase().includes(q)) ||
        (z.warehouseId?.name && z.warehouseId.name.toLowerCase().includes(q)) ||
        (z.warehouseId?.code && z.warehouseId.code.toLowerCase().includes(q))
    );
  }, [zones, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const paginatedZones = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredZones.slice(start, start + pageSize);
  }, [filteredZones, currentPage, pageSize]);

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50 p-3 md:p-4 lg:p-5 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Zones</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage warehouse zones / areas for rack grouping ({zones.length} total zones)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 active:scale-95 transition self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" /> Add Zone
          </button>
        </div>

        {/* Modal for adding zone */}
        <AddZoneModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          warehouses={warehouses}
          onAddNewWarehouse={() => setIsAddWarehouseModalOpen(true)}
          onSuccess={() => void fetchZones()}
        />

        {/* Nested modal for creating warehouse on the fly */}
        <AddWarehouseModal
          isOpen={isAddWarehouseModalOpen}
          onClose={() => setIsAddWarehouseModalOpen(false)}
          zIndex="z-[70]"
          onSuccess={() => void fetchWarehouses()}
        />

        {/* Zone list */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 md:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Zone List ({filteredZones.length})
            </h2>

            <input
              type="text"
              placeholder="Search zone name, code, warehouse..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-violet-500 w-full sm:w-64"
            />
          </div>

          {/* Loading */}
          {fetching && (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
              <svg className="h-5 w-5 animate-spin text-violet-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading zones...
            </div>
          )}

          {/* Desktop table */}
          {!fetching && paginatedZones.length > 0 && (
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Zone Name</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Warehouse</th>
                    <th className="px-5 py-3">Racks</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedZones.map((zone) => (
                    <tr
                      key={zone._id}
                      onClick={() => setSelectedZoneId(zone._id)}
                      className="border-t border-slate-100 hover:bg-violet-50/40 transition cursor-pointer"
                    >
                      <td className="px-5 py-3 font-medium text-slate-800">
                        <div className="font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1.5 group">
                          <Layers className="h-4 w-4 text-violet-500 shrink-0 group-hover:scale-110 transition" />
                          <span>{zone.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {zone.code ? (
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {zone.code}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {zone.warehouseId?._id ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWarehouseId(zone.warehouseId._id);
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-semibold text-xs flex items-center gap-1 cursor-pointer"
                            title="Click to view this warehouse details"
                          >
                            <WarehouseIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span>{zone.warehouseId.name}</span>
                            <span className="font-mono text-slate-400 font-normal">({zone.warehouseId.code})</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700"
                          title="Racks in this zone"
                        >
                          <Box className="h-3 w-3" /> {zone.rackCount ?? 0} Racks
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            zone.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {zone.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedZoneId(zone._id);
                            }}
                            className="rounded-lg border border-violet-200 bg-violet-50/50 px-2.5 py-1 text-xs font-bold text-violet-700 hover:bg-violet-100 transition flex items-center gap-1 cursor-pointer"
                            title="View Zone Details & Racks"
                          >
                            <Eye className="h-3.5 w-3.5" /> Details
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(zone);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 cursor-pointer"
                          >
                            Edit
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteId(zone._id);
                              }}
                              className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile cards */}
          {!fetching && paginatedZones.length > 0 && (
            <div className="space-y-3 p-4 md:hidden">
              {paginatedZones.map((zone) => (
                <div
                  key={zone._id}
                  onClick={() => setSelectedZoneId(zone._id)}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2 cursor-pointer hover:border-violet-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-violet-600 text-sm">
                        {zone.name}
                      </div>
                      {zone.code && (
                        <p className="mt-0.5 text-xs text-slate-500 font-mono font-semibold">{zone.code}</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                        zone.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {zone.status}
                    </span>
                  </div>
                  {zone.warehouseId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWarehouseId(zone.warehouseId._id);
                      }}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <WarehouseIcon className="h-3 w-3 text-slate-400" />
                      <span>{zone.warehouseId.name} ({zone.warehouseId.code})</span>
                    </button>
                  )}
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700">
                      <Box className="h-3 w-3" /> {zone.rackCount ?? 0} Racks
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedZoneId(zone._id);
                      }}
                      className="flex-1 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 transition flex items-center justify-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" /> Details
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(zone);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(zone._id);
                        }}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!fetching && filteredZones.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">No zones found</p>
          )}

          {/* Pagination */}
          {!fetching && filteredZones.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredZones.length}
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
              <h3 className="text-lg font-semibold text-slate-800">Edit Zone</h3>
              <form onSubmit={handleEditSubmit} className="mt-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Zone Name</label>
                  <input
                    type="text"
                    placeholder="Zone name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-600 uppercase">Zone Code (Optional)</label>
                    <span className="text-[10px] text-slate-400">e.g. ZA, ROOM-101</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Zone code (optional)"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm uppercase outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Warehouse</label>
                  <SearchableSelect
                    options={warehouseOptions}
                    value={editWarehouseId}
                    onChange={setEditWarehouseId}
                    placeholder="Search warehouse..."
                    onAddNew={() => setIsAddWarehouseModalOpen(true)}
                    addNewLabel="Add Warehouse"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="flex-1 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
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
              <h3 className="text-lg font-semibold text-red-600">Delete Zone</h3>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to delete this zone? This action cannot be undone.
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

      {/* Zone Details Inspection Modal */}
      <ZoneDetailsModal
        zoneId={selectedZoneId}
        onClose={() => setSelectedZoneId(null)}
        onEditZone={(z) => {
          setSelectedZoneId(null);
          openEdit(z as Zone);
        }}
        onSelectWarehouse={(whId) => {
          setSelectedZoneId(null);
          setSelectedWarehouseId(whId);
        }}
        onSelectRack={(rkId) => {
          setSelectedZoneId(null);
          setSelectedRackId(rkId);
        }}
      />

      {/* Warehouse Details Inspection Modal */}
      <WarehouseDetailsModal
        warehouseId={selectedWarehouseId}
        onClose={() => setSelectedWarehouseId(null)}
        onSelectRack={(rkId) => {
          setSelectedWarehouseId(null);
          setSelectedRackId(rkId);
        }}
        onSelectZone={(zId) => {
          setSelectedWarehouseId(null);
          setSelectedZoneId(zId);
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
        onSelectZone={(zId) => {
          setSelectedRackId(null);
          setSelectedZoneId(zId);
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
