"use client";

import { useEffect, useState } from "react";
import {
  X,
  Box,
  Warehouse,
  Tag,
  Package,
  ExternalLink,
  Loader2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export type RackDetailsData = {
  rack: {
    _id: string;
    name: string;
    code: string;
    status: "ACTIVE" | "INACTIVE";
    warehouseId?: {
      _id: string;
      name: string;
      code: string;
      address?: string;
    };
    createdAt: string;
  };
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
    warehouseId: {
      _id: string;
      name: string;
      code: string;
    };
    quantity: number;
    status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
  }>;
  summary: {
    totalProducts: number;
    totalUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
};

interface RackDetailsModalProps {
  rackId: string | null;
  onClose: () => void;
  onEditRack?: (rack: any) => void;
  onSelectWarehouse?: (warehouseId: string) => void;
}

export default function RackDetailsModal({
  rackId,
  onClose,
  onEditRack,
  onSelectWarehouse,
}: RackDetailsModalProps) {
  const [data, setData] = useState<RackDetailsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rackId) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetch(`/api/racks/${rackId}`)
      .then((res) => res.json())
      .then((res) => {
        if (isMounted && res.success) {
          setData(res.data);
        }
      })
      .catch((err) => console.error("Error fetching rack details:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [rackId]);

  if (!rackId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl my-auto rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Box className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-800 text-base sm:text-lg truncate">
                  {data?.rack.name || "Rack Details"}
                </h3>
                {data?.rack.code && (
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 font-mono text-xs font-bold text-indigo-800 uppercase">
                    {data.rack.code}
                  </span>
                )}
                {data?.rack.status && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      data.rack.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {data.rack.status}
                  </span>
                )}
              </div>
              {data?.rack.warehouseId && (
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                  <Warehouse className="h-3.5 w-3.5 text-slate-400" />
                  <span>Located in:</span>
                  {onSelectWarehouse ? (
                    <button
                      type="button"
                      onClick={() => onSelectWarehouse(data.rack.warehouseId!._id)}
                      className="font-bold text-blue-600 hover:underline"
                    >
                      {data.rack.warehouseId.name} ({data.rack.warehouseId.code})
                    </button>
                  ) : (
                    <span className="font-semibold text-slate-700">
                      {data.rack.warehouseId.name} ({data.rack.warehouseId.code})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {data && onEditRack && (
              <button
                type="button"
                onClick={() => onEditRack(data.rack)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                Edit
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
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-xs font-semibold text-slate-500">
              Loading rack inventory contents...
            </p>
          </div>
        )}

        {/* Content */}
        {!loading && data && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-indigo-50/50 p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-indigo-700 uppercase">Product Lines</span>
                  <Tag className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="text-2xl font-extrabold text-indigo-900 mt-1">
                  {data.summary.totalProducts}
                </p>
                <p className="text-[10px] text-indigo-600 mt-0.5">Distinct items on this rack</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-emerald-50/50 p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase">Total Stock</span>
                  <Package className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-extrabold text-emerald-900 mt-1">
                  {data.summary.totalUnits.toLocaleString("en-IN")}{" "}
                  <span className="text-xs font-medium text-emerald-700">units</span>
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Total units sitting on rack</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-2xs col-span-2 sm:col-span-1">
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

            {/* Inventory table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-slate-500" />
                  Inventory Items on This Rack ({data.inventory.length})
                </h4>
                {data.rack.warehouseId && (
                  <Link
                    href={`/inventory?warehouseId=${data.rack.warehouseId._id}&rackId=${data.rack._id}&restock=true`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    Restock Rack <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {data.inventory.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                  No products currently stocked in this rack.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Product Name & SKU</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Quantity</th>
                        <th className="p-3">Stock Status</th>
                        <th className="p-3 text-right">Unit Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {data.inventory.map((inv) => (
                        <tr key={inv._id} className="hover:bg-slate-50/60 transition">
                          <td className="p-3">
                            <p className="font-bold text-slate-800">
                              {inv.productId?.name || "Product"}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400">
                              SKU: {inv.productId?.sku}
                            </p>
                          </td>
                          <td className="p-3 text-slate-600">
                            {inv.productId?.category || "General"}
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
