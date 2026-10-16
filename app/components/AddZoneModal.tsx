"use client";

import { FormEvent, useState, useEffect, useMemo } from "react";
import { X, Layers, Loader2 } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import WarningPopup from "@/app/components/WarningPopup";

type WarehouseItem = {
  _id: string;
  name: string;
  code: string;
};

type ZoneResult = {
  _id: string;
  name: string;
  code: string;
  warehouseId: any;
};

type AddZoneModalProps = {
  isOpen: boolean;
  onClose: () => void;
  warehouses: WarehouseItem[];
  defaultWarehouseId?: string;
  onSuccess?: (zone: ZoneResult) => void;
  onAddNewWarehouse?: () => void;
  zIndex?: string;
};

export default function AddZoneModal({
  isOpen,
  onClose,
  warehouses,
  defaultWarehouseId = "",
  onSuccess,
  onAddNewWarehouse,
  zIndex = "z-50",
}: AddZoneModalProps) {
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  useEffect(() => {
    if (defaultWarehouseId) {
      setWarehouseId(defaultWarehouseId);
    }
  }, [defaultWarehouseId]);

  // Auto-select the only warehouse when there's just one and no default
  useEffect(() => {
    if (warehouses.length === 1 && !warehouseId && !defaultWarehouseId) {
      setWarehouseId(warehouses[0]._id);
    }
  }, [warehouses, warehouseId, defaultWarehouseId]);

  const warehouseOptions: SelectOption[] = useMemo(() => {
    return warehouses.map((w) => ({
      value: w._id,
      label: w.name,
      subLabel: w.code,
    }));
  }, [warehouses]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!warehouseId) {
      setWarningMessage("Please select a warehouse for this zone");
      setWarningOpen(true);
      return;
    }
    setLoading(true);

    try {
      const response = await fetch("/api/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId,
          name: name.trim(),
          code: code.trim().toUpperCase(),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.error ? `${result.message || "Failed to add zone"}: ${result.error}` : (result.message || "Failed to add zone"));
        setWarningOpen(true);
        return;
      }

      setName("");
      setCode("");
      if (onSuccess && result.data) {
        onSuccess(result.data);
      }
      onClose();
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150`}>
        <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Add New Zone</h3>
                <p className="text-xs text-slate-500">Add a zone/area to a warehouse</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Warehouse <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={warehouseOptions}
                value={warehouseId}
                onChange={setWarehouseId}
                placeholder="Select parent warehouse..."
                onAddNew={onAddNewWarehouse}
                addNewLabel="Add Warehouse"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Zone Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Zone A, Electronics Wing, Cold Storage"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Zone Code (Optional)
                </label>
                <span className="text-[10px] text-slate-400">e.g. ZA, ROOM-101</span>
              </div>
              <input
                type="text"
                placeholder="e.g. ZA, ZB (Optional)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm uppercase outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 transition"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {loading ? "Adding..." : "+ Create Zone"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <WarningPopup
        open={warningOpen}
        onClose={() => setWarningOpen(false)}
        message={warningMessage}
      />
    </>
  );
}
