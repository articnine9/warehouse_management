"use client";

import { FormEvent, useId, useState } from "react";
import { ArrowRightLeft, Loader2, X } from "lucide-react";
import ProductTypeBadge from "./ProductTypeBadge";

type Location = {
  inventoryId?: string;
  warehouseId: string;
  warehouseName: string;
  zoneName?: string;
  rackId: string;
  rackName: string;
  quantity: number;
};

type Props = {
  product: { _id: string; name: string; sku: string; productType?: string; locations?: Location[] };
  zones: { _id: string; name: string; warehouseId?: string | { _id: string } }[];
  racks: { _id: string; name: string; code: string; warehouseId: string | { _id: string }; zoneId?: string | { _id: string } }[];
  onClose: () => void;
  onSuccess: () => void;
  zIndex?: string;
};

export default function MoveProductModal({ product, zones, racks, onClose, onSuccess, zIndex = "z-50" }: Props) {
  const locations = (product.locations || []).filter((location) => location.inventoryId);
  const [inventoryId, setInventoryId] = useState(locations[0]?.inventoryId || "");
  const [zoneId, setZoneId] = useState("");
  const [rackId, setRackId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const source = locations.find((location) => location.inventoryId === inventoryId);
  const destinationZones = zones.filter((zone) => (typeof zone.warehouseId === "object" ? zone.warehouseId._id : zone.warehouseId) === source?.warehouseId);
  const destinationRacks = racks.filter((rack) => {
    const warehouseId = typeof rack.warehouseId === "object" ? rack.warehouseId._id : rack.warehouseId;
    const rackZoneId = typeof rack.zoneId === "object" ? rack.zoneId._id : rack.zoneId;
    return warehouseId === source?.warehouseId && rackZoneId === zoneId && rack._id !== source?.rackId && !locations.some((location) => location.rackId === rack._id);
  });

  async function handleMove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !source || !zoneId || !rackId) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/products/${product._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId, zoneId, rackId, sourceRackId: source.rackId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to move this product. Please try again.");
      onSuccess();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to move this product. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/50 p-4`}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="flex items-center gap-2 text-lg font-bold text-slate-800"><ArrowRightLeft className="h-5 w-5 text-blue-600" />Move Product</h2>
            <p className="mt-1 text-sm font-semibold text-slate-700">{product.name}</p>
            <p className="text-xs text-slate-500">SKU: {product.sku}</p>
            <ProductTypeBadge productType={product.productType} />
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Close move product" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>
        {locations.length === 0 ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-slate-600">Assign this product to a rack in Inventory before moving it.</p>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Close</button>
          </div>
        ) : (
          <form onSubmit={handleMove} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Move from
              <select autoFocus value={inventoryId} disabled={saving} onChange={(event) => { setInventoryId(event.target.value); setZoneId(""); setRackId(""); setError(""); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm" required>
                {locations.map((location) => <option key={location.inventoryId} value={location.inventoryId}>{location.warehouseName} / {location.zoneName ? `${location.zoneName} / ` : ""}{location.rackName} ({location.quantity} units)</option>)}
              </select>
            </label>
            <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">All {source?.quantity ?? 0} units at this location will move within {source?.warehouseName}. Stock quantity stays the same.</p>
            <label className="block text-sm font-semibold text-slate-700">
              Destination Zone / Room
              <select value={zoneId} disabled={saving} onChange={(event) => { setZoneId(event.target.value); setRackId(""); setError(""); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm" required>
                <option value="">Select destination zone...</option>
                {destinationZones.map((zone) => <option key={zone._id} value={zone._id}>{zone.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Destination Rack
              <select value={rackId} disabled={saving || !zoneId} onChange={(event) => { setRackId(event.target.value); setError(""); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm disabled:bg-slate-100" required>
                <option value="">Select destination rack...</option>
                {destinationRacks.map((rack) => <option key={rack._id} value={rack._id}>{rack.name} ({rack.code})</option>)}
              </select>
            </label>
            {zoneId && destinationRacks.length === 0 && <p className="text-xs text-amber-700">No other racks are available in this zone. Choose another zone. Racks already assigned to this product cannot be selected.</p>}
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={saving || !rackId || !zoneId} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Moving..." : "Move Product"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
