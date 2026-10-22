"use client";

import { useEffect, useState } from "react";
import {
  X,
  Warehouse as WarehouseIcon,
  Box,
  Tag,
  Package,
  Users,
  MapPin,
  ExternalLink,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/app/components/AuthProvider";

export type WarehouseDetailsData = {
  warehouse: {
    _id: string;
    name: string;
    code: string;
    address?: string;
    status: "ACTIVE" | "INACTIVE";
    createdAt: string;
  };
  zones?: Array<{
    _id: string;
    name: string;
    code?: string;
    status: "ACTIVE" | "INACTIVE";
    rackCount: number;
  }>;
  racks: Array<{
    _id: string;
    name: string;
    code: string;
    status: "ACTIVE" | "INACTIVE";
    zoneId?: {
      _id: string;
      name: string;
      code?: string;
    };
    productCount: number;
    totalUnits: number;
  }>;
  inventory: Array<{
    _id: string;
    productId: {
      _id: string;
      name: string;
      sku: string;
      price?: number;
      category?: string;
      unit?: string;
    };
    rackId: {
      _id: string;
      name: string;
      code: string;
    };
    quantity: number;
    status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
  }>;
  employees: Array<{
    _id: string;
    name: string;
    employeeCode: string;
    department: string;
    designation: string;
    phone?: string;
    email?: string;
  }>;
  summary: {
    totalZones?: number;
    totalRacks: number;
    totalProducts: number;
    totalUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalEmployees: number;
  };
};

interface WarehouseDetailsModalProps {
  warehouseId: string | null;
  onClose: () => void;
  onEditWarehouse?: (warehouse: WarehouseDetailsData["warehouse"]) => void;
  onDeleteWarehouse?: (warehouseId: string) => void;
  onDeleteSuccess?: () => void;
  onSelectRack?: (rackId: string) => void;
  onSelectZone?: (zoneId: string) => void;
  onAddRack?: (warehouseId: string) => void;
  onAddZone?: (warehouseId: string) => void;
}

export default function WarehouseDetailsModal({
  warehouseId,
  onClose,
  onEditWarehouse,
  onDeleteWarehouse,
  onDeleteSuccess,
  onSelectRack,
  onSelectZone,
  onAddRack,
  onAddZone,
}: WarehouseDetailsModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [data, setData] = useState<WarehouseDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"ZONES" | "RACKS" | "INVENTORY" | "STAFF">("RACKS");

  // Delete states
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "WAREHOUSE" | "ZONE" | "RACK" | "INVENTORY";
    id: string;
    name: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function reloadWarehouseData() {
    if (!warehouseId) return;
    try {
      const res = await fetch(`/api/warehouses/${warehouseId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Error reloading warehouse details:", err);
    }
  }

  async function handleDeleteExecute() {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    setDeleteError("");

    try {
      let endpoint = "";
      if (deleteConfirm.type === "WAREHOUSE") endpoint = `/api/warehouses/${deleteConfirm.id}`;
      else if (deleteConfirm.type === "ZONE") endpoint = `/api/zones/${deleteConfirm.id}`;
      else if (deleteConfirm.type === "RACK") endpoint = `/api/racks/${deleteConfirm.id}`;
      else if (deleteConfirm.type === "INVENTORY") endpoint = `/api/inventory/${deleteConfirm.id}`;

      const res = await fetch(endpoint, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setDeleteError(json.message || `Failed to delete ${deleteConfirm.type.toLowerCase()}`);
      } else {
        setDeleteConfirm(null);
        if (deleteConfirm.type === "WAREHOUSE") {
          onClose();
          if (onDeleteWarehouse) onDeleteWarehouse(deleteConfirm.id);
          else if (onDeleteSuccess) onDeleteSuccess();
        } else {
          await reloadWarehouseData();
          if (onDeleteSuccess) onDeleteSuccess();
        }
      }
    } catch (err) {
      console.error("Delete error:", err);
      setDeleteError("Network error occurred while deleting");
    } finally {
      setDeleteLoading(false);
    }
  }

  useEffect(() => {
    if (!warehouseId) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetch(`/api/warehouses/${warehouseId}`)
      .then((res) => res.json())
      .then((res) => {
        if (isMounted && res.success) {
          setData(res.data);
        }
      })
      .catch((err) => console.error("Error fetching warehouse details:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [warehouseId]);

  if (!warehouseId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl my-auto rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <WarehouseIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-800 text-base sm:text-lg truncate">
                  {data?.warehouse.name || "Warehouse Details"}
                </h3>
                {data?.warehouse.code && (
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 font-mono text-xs font-bold text-blue-800 uppercase">
                    {data.warehouse.code}
                  </span>
                )}
                {data?.warehouse.status && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      data.warehouse.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {data.warehouse.status}
                  </span>
                )}
              </div>
              {data?.warehouse.address && (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {data.warehouse.address}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {data && onEditWarehouse && (
              <button
                type="button"
                onClick={() => {
                  onEditWarehouse(data.warehouse);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              >
                Edit
              </button>
            )}
            {data && isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirm({
                    type: "WAREHOUSE",
                    id: data.warehouse._id,
                    name: data.warehouse.name,
                  });
                }}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition shadow-2xs cursor-pointer flex items-center gap-1"
                title="Delete Warehouse"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shrink-0 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-xs font-semibold text-slate-500">
              Loading warehouse racks and inventory...
            </p>
          </div>
        )}

        {/* Content */}
        {!loading && data && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-xl border border-slate-200 bg-violet-50/50 p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-violet-700 uppercase">Zones / Rooms</span>
                  <Layers className="h-4 w-4 text-violet-600" />
                </div>
                <p className="text-2xl font-extrabold text-violet-900 mt-1">
                  {data.summary.totalZones ?? data.zones?.length ?? 0}
                </p>
                <p className="text-[10px] text-violet-600 mt-0.5">Sub-divided rooms/sections</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-blue-50/50 p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-blue-700 uppercase">Racks Allocated</span>
                  <Box className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-2xl font-extrabold text-blue-900 mt-1">
                  {data.summary.totalRacks}
                </p>
                <p className="text-[10px] text-blue-600 mt-0.5">Storage racks inside</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-indigo-50/50 p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-indigo-700 uppercase">Distinct Products</span>
                  <Tag className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="text-2xl font-extrabold text-indigo-900 mt-1">
                  {data.summary.totalProducts}
                </p>
                <p className="text-[10px] text-indigo-600 mt-0.5">Product lines stocked</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-emerald-50/50 p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase">Total Inventory</span>
                  <Package className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-extrabold text-emerald-900 mt-1">
                  {data.summary.totalUnits.toLocaleString("en-IN")}{" "}
                  <span className="text-xs font-medium text-emerald-700">units</span>
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Physical items stored</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-2xs col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700 uppercase">Assigned Staff</span>
                  <Users className="h-4 w-4 text-slate-500" />
                </div>
                <p className="text-2xl font-extrabold text-slate-800 mt-1">
                  {data.summary.totalEmployees}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Active personnel linked</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setActiveTab("ZONES")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                    activeTab === "ZONES"
                      ? "bg-violet-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Zones / Rooms ({data.zones?.length ?? 0})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("RACKS")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                    activeTab === "RACKS"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Box className="h-3.5 w-3.5" />
                  Racks in Warehouse ({data.racks.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("INVENTORY")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                    activeTab === "INVENTORY"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Package className="h-3.5 w-3.5" />
                  Stored Products ({data.inventory.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("STAFF")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                    activeTab === "STAFF"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Assigned Personnel ({data.employees.length})
                </button>
              </div>

              {activeTab === "ZONES" && onAddZone && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAddZone(warehouseId);
                  }}
                  className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 transition shadow-2xs cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Zone
                </button>
              )}

              {activeTab === "RACKS" && onAddRack && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAddRack(warehouseId);
                  }}
                  className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-2xs cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Rack
                </button>
              )}
            </div>

            {/* TAB: ZONES LIST */}
            {activeTab === "ZONES" && (
              <div className="space-y-3">
                {(!data.zones || data.zones.length === 0) ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl space-y-2">
                    <Layers className="h-8 w-8 text-slate-300 mx-auto" />
                    <p>No zones / rooms configured for this warehouse yet.</p>
                    {onAddZone && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onAddZone(warehouseId);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create First Zone
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.zones.map((zone) => (
                      <div
                        key={zone._id}
                        onClick={() => {
                          if (onSelectZone) onSelectZone(zone._id);
                        }}
                        className="rounded-xl border border-slate-200 bg-white p-4 hover:border-violet-300 hover:shadow-md transition cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 group-hover:scale-110 transition">
                              <Layers className="h-4 w-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-violet-600 transition">
                                {zone.name}
                              </h4>
                              {zone.code && (
                                <span className="font-mono text-[10px] text-slate-400">{zone.code}</span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              zone.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {zone.status}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">
                            <span className="font-bold text-slate-800">{zone.rackCount || 0}</span> Racks inside
                          </span>
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm({
                                    type: "ZONE",
                                    id: zone._id,
                                    name: zone.name,
                                  });
                                }}
                                className="rounded px-2 py-0.5 text-[11px] font-bold text-red-600 hover:bg-red-50 border border-red-200 transition cursor-pointer flex items-center gap-0.5"
                                title="Delete Zone"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                            )}
                            <span className="text-violet-600 font-bold inline-flex items-center gap-0.5 text-[11px] group-hover:translate-x-0.5 transition">
                              View Zone &rarr;
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: RACKS LIST */}
            {activeTab === "RACKS" && (
              <div className="space-y-3">
                {data.racks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl space-y-2">
                    <p>No storage racks created for this warehouse yet.</p>
                    {onAddRack && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onAddRack(warehouseId);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create First Rack
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Rack Name & Code</th>
                          <th className="p-3">Zone / Room</th>
                          <th className="p-3">Product Types</th>
                          <th className="p-3">Total Units</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {data.racks.map((rack) => (
                          <tr key={rack._id} className="hover:bg-slate-50/60 transition">
                            <td className="p-3">
                              <p className="font-bold text-slate-800">{rack.name}</p>
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {rack.code}
                              </span>
                            </td>
                            <td className="p-3">
                              {rack.zoneId ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSelectZone) onSelectZone(rack.zoneId!._id);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full bg-violet-50 hover:bg-violet-100 border border-violet-200 px-2 py-0.5 text-[10px] font-bold text-violet-700 transition"
                                  title="View Zone"
                                >
                                  <Layers className="h-2.5 w-2.5 text-violet-500" />
                                  <span>{rack.zoneId.name}</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Unassigned</span>
                              )}
                            </td>
                            <td className="p-3 font-semibold text-slate-700">
                              <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-700 px-2 py-0.5 font-bold text-[11px]">
                                <Tag className="h-3 w-3" /> {rack.productCount} products
                              </span>
                            </td>
                            <td className="p-3 font-bold text-slate-800">
                              {rack.totalUnits.toLocaleString("en-IN")} units
                            </td>
                            <td className="p-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  rack.status === "ACTIVE"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {rack.status}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteConfirm({
                                        type: "RACK",
                                        id: rack._id,
                                        name: rack.name,
                                      });
                                    }}
                                    className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100 transition inline-flex items-center gap-1 cursor-pointer"
                                    title="Delete Rack"
                                  >
                                    <Trash2 className="h-3 w-3" /> Delete
                                  </button>
                                )}
                                {onSelectRack && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectRack(rack._id)}
                                    className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    View Rack <ExternalLink className="h-3 w-3" />
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
              </div>
            )}

            {/* TAB 2: STORED INVENTORY */}
            {activeTab === "INVENTORY" && (
              <div className="space-y-3">
                {data.inventory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No products currently stored in this warehouse.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Product</th>
                          <th className="p-3">Rack Location</th>
                          <th className="p-3">Quantity</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Unit Price</th>
                          {isAdmin && <th className="p-3 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {data.inventory.map((inv) => (
                          <tr key={inv._id} className="hover:bg-slate-50/60 transition">
                            <td className="p-3">
                              <p className="font-bold text-slate-800">
                                {inv.productId?.name || "Unknown Product"}
                              </p>
                              <p className="font-mono text-[10px] text-slate-400">
                                SKU: {inv.productId?.sku}
                              </p>
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-slate-700">
                                {inv.rackId?.name || "Unassigned"}
                              </span>
                              {inv.rackId?.code && (
                                <span className="font-mono text-[10px] text-slate-400 block">
                                  ({inv.rackId.code})
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-extrabold text-slate-800 text-sm">
                              {inv.quantity} <span className="text-xs font-normal text-slate-500">{inv.productId?.unit || "units"}</span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                  inv.status === "AVAILABLE"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : inv.status === "LOW_STOCK"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-red-50 text-red-700 border border-red-200"
                                }`}
                              >
                                {inv.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="p-3 text-right font-semibold text-slate-700">
                              {inv.productId?.price !== undefined
                                ? `₹${inv.productId.price.toLocaleString("en-IN")}`
                                : "-"}
                            </td>
                            {isAdmin && (
                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteConfirm({
                                      type: "INVENTORY",
                                      id: inv._id,
                                      name: `${inv.productId?.name || "Product"} (${inv.quantity} units)`,
                                    });
                                  }}
                                  className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100 transition inline-flex items-center gap-1 cursor-pointer"
                                  title="Delete Inventory"
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
                )}
              </div>
            )}

            {/* TAB 3: ASSIGNED STAFF */}
            {activeTab === "STAFF" && (
              <div className="space-y-3">
                {data.employees.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No staff members currently assigned to this warehouse base.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.employees.map((emp) => (
                      <div
                        key={emp._id}
                        className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs space-y-1 hover:shadow-xs transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-sm">{emp.name}</span>
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                            {emp.employeeCode}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px]">
                          {emp.designation} • <b className="text-slate-700">{emp.department}</b>
                        </p>
                        <div className="pt-1 flex items-center gap-3 text-slate-600 text-[11px]">
                          {emp.phone && <span>Tel: {emp.phone}</span>}
                          {emp.email && <span>Email: {emp.email}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal for Admin */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-red-600">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Delete {deleteConfirm.type.charAt(0) + deleteConfirm.type.slice(1).toLowerCase()}
                  </h3>
                  <p className="text-xs text-slate-500">Admin Authorization Required</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-red-50/60 border border-red-200/60 p-3 text-xs text-red-800">
                <p className="font-semibold">
                  Are you sure you want to delete <span className="font-bold underline">{deleteConfirm.name}</span>?
                </p>
                <p className="mt-1 text-[11px] text-red-700">
                  This action cannot be undone. Any linked associations might be permanently removed.
                </p>
              </div>

              {deleteError && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirm(null);
                    setDeleteError("");
                  }}
                  disabled={deleteLoading}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteExecute}
                  disabled={deleteLoading}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {deleteLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {deleteLoading ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
