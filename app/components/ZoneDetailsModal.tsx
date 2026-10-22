"use client";

import { useEffect, useState } from "react";
import {
  X,
  Layers,
  Box,
  Warehouse,
  Tag,
  Package,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/app/components/AuthProvider";

export type ZoneDetailsData = {
  zone: {
    _id: string;
    name: string;
    code?: string;
    status: "ACTIVE" | "INACTIVE";
    warehouseId?: {
      _id: string;
      name: string;
      code: string;
      address?: string;
    };
    createdAt: string;
  };
  racks: Array<{
    _id: string;
    name: string;
    code: string;
    status: "ACTIVE" | "INACTIVE";
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
  summary: {
    totalRacks: number;
    totalProducts: number;
    totalUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
};

interface ZoneDetailsModalProps {
  zoneId: string | null;
  onClose: () => void;
  onEditZone?: (zone: any) => void;
  onDeleteZone?: (zoneId: string) => void;
  onDeleteSuccess?: () => void;
  onSelectWarehouse?: (warehouseId: string) => void;
  onSelectRack?: (rackId: string) => void;
}

export default function ZoneDetailsModal({
  zoneId,
  onClose,
  onEditZone,
  onDeleteZone,
  onDeleteSuccess,
  onSelectWarehouse,
  onSelectRack,
}: ZoneDetailsModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [data, setData] = useState<ZoneDetailsData | null>(null);
  const [loading, setLoading] = useState(false);

  // Delete states
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "ZONE" | "RACK";
    id: string;
    name: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function reloadZoneData() {
    if (!zoneId) return;
    try {
      const res = await fetch(`/api/zones/${zoneId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Error reloading zone:", err);
    }
  }

  async function handleDeleteExecute() {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    setDeleteError("");

    try {
      const endpoint = deleteConfirm.type === "ZONE"
        ? `/api/zones/${deleteConfirm.id}`
        : `/api/racks/${deleteConfirm.id}`;

      const res = await fetch(endpoint, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setDeleteError(json.message || `Failed to delete ${deleteConfirm.type.toLowerCase()}`);
      } else {
        setDeleteConfirm(null);
        if (deleteConfirm.type === "ZONE") {
          onClose();
          if (onDeleteZone) onDeleteZone(deleteConfirm.id);
          else if (onDeleteSuccess) onDeleteSuccess();
        } else {
          await reloadZoneData();
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
    if (!zoneId) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetch(`/api/zones/${zoneId}`)
      .then((res) => res.json())
      .then((res) => {
        if (isMounted && res.success) {
          setData(res.data);
        }
      })
      .catch((err) => console.error("Error fetching zone details:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [zoneId]);

  if (!zoneId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl my-auto rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
              <Layers className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-800 text-base sm:text-lg truncate">
                  {data?.zone.name || "Zone Details"}
                </h3>
                {data?.zone.code && (
                  <span className="rounded-md bg-violet-100 px-2 py-0.5 font-mono text-xs font-bold text-violet-800 uppercase">
                    {data.zone.code}
                  </span>
                )}
                {data?.zone.status && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      data.zone.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {data.zone.status}
                  </span>
                )}
              </div>
              {data?.zone.warehouseId && (
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                  <Warehouse className="h-3.5 w-3.5 text-slate-400" />
                  <span>Warehouse:</span>
                  {onSelectWarehouse ? (
                    <button
                      type="button"
                      onClick={() => onSelectWarehouse(data.zone.warehouseId!._id)}
                      className="font-bold text-blue-600 hover:underline"
                    >
                      {data.zone.warehouseId.name} ({data.zone.warehouseId.code})
                    </button>
                  ) : (
                    <span className="font-semibold text-slate-700">
                      {data.zone.warehouseId.name} ({data.zone.warehouseId.code})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {data && onEditZone && (
              <button
                type="button"
                onClick={() => onEditZone(data.zone)}
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
                    type: "ZONE",
                    id: data.zone._id,
                    name: data.zone.name,
                  });
                }}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition shadow-2xs cursor-pointer flex items-center gap-1"
                title="Delete Zone"
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

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            <p className="text-xs font-semibold text-slate-500">
              Loading zone details...
            </p>
          </div>
        )}

        {/* Content */}
        {!loading && data && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-violet-50/50 p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-violet-700 uppercase">Racks</span>
                  <Box className="h-4 w-4 text-violet-600" />
                </div>
                <p className="text-2xl font-extrabold text-violet-900 mt-1">
                  {data.summary.totalRacks}
                </p>
                <p className="text-[10px] text-violet-600 mt-0.5">Racks in this zone</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-indigo-50/50 p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-indigo-700 uppercase">Products</span>
                  <Tag className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="text-2xl font-extrabold text-indigo-900 mt-1">
                  {data.summary.totalProducts}
                </p>
                <p className="text-[10px] text-indigo-600 mt-0.5">Distinct product lines</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-emerald-50/50 p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase">Stock</span>
                  <Package className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-extrabold text-emerald-900 mt-1">
                  {data.summary.totalUnits.toLocaleString("en-IN")}{" "}
                  <span className="text-xs font-medium text-emerald-700">units</span>
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Total units in zone</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700 uppercase">Alerts</span>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-2xl font-extrabold text-slate-800 mt-1">
                  {data.summary.lowStockCount + data.summary.outOfStockCount}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {data.summary.outOfStockCount > 0
                    ? `${data.summary.outOfStockCount} out of stock`
                    : "Stock levels normal"}
                </p>
              </div>
            </div>

            {/* Racks grid */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Box className="h-4 w-4 text-slate-500" />
                Racks in This Zone ({data.racks.length})
              </h4>

              {data.racks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                  No racks assigned to this zone yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {data.racks.map((rack) => (
                    <div
                      key={rack._id}
                      className={`rounded-xl border p-3 transition hover:shadow-md ${
                        rack.status === "ACTIVE"
                          ? "border-slate-200 bg-white hover:border-violet-300"
                          : "border-slate-100 bg-slate-50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                          {rack.code}
                        </span>
                        <div className="flex items-center gap-1.5">
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
                              className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50 transition cursor-pointer"
                              title="Delete Rack"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span
                            className={`h-2 w-2 rounded-full ${
                              rack.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                        </div>
                      </div>
                      <p
                        onClick={() => onSelectRack?.(rack._id)}
                        className="text-sm font-semibold text-slate-800 truncate cursor-pointer hover:text-violet-600 transition"
                      >
                        {rack.name}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-medium">
                            {rack.productCount} items
                          </span>
                          <span className="text-[10px] text-slate-400">|</span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {rack.totalUnits} units
                          </span>
                        </div>
                        {onSelectRack && (
                          <button
                            type="button"
                            onClick={() => onSelectRack(rack._id)}
                            className="text-[10px] font-bold text-violet-600 hover:underline cursor-pointer"
                          >
                            View &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                    Delete {deleteConfirm.type === "ZONE" ? "Zone" : "Rack"}
                  </h3>
                  <p className="text-xs text-slate-500">Admin Authorization Required</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-red-50/60 border border-red-200/60 p-3 text-xs text-red-800">
                <p className="font-semibold">
                  Are you sure you want to delete <span className="font-bold underline">{deleteConfirm.name}</span>?
                </p>
                <p className="mt-1 text-[11px] text-red-700">
                  This action cannot be undone. Any linked entities will be affected.
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
