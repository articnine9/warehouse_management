"use client";

import { FormEvent, useState } from "react";
import { X, Warehouse as WarehouseIcon, Loader2 } from "lucide-react";
import WarningPopup from "@/app/components/WarningPopup";

type WarehouseResult = {
  _id: string;
  name: string;
  code: string;
  address?: string;
};

type AddWarehouseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (warehouse: WarehouseResult) => void;
  zIndex?: string;
};

export default function AddWarehouseModal({
  isOpen,
  onClose,
  onSuccess,
  zIndex = "z-50",
}: AddWarehouseModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          address: address.trim(),
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
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <WarehouseIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Add New Warehouse</h3>
                <p className="text-xs text-slate-500">Register a new storage location</p>
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
                Warehouse Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Central Warehouse, North Branch"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Warehouse Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. WH-01, BLR-HUB"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Address / Location (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Industrial Area Phase 2, Chennai"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
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
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {loading ? "Adding..." : "+ Create Warehouse"}
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
