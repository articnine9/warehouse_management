"use client";

import { FormEvent, useState, useEffect, useMemo } from "react";
import { X, ClipboardList, Loader2 } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import WarningPopup from "@/app/components/WarningPopup";
import AddProductModal from "@/app/components/AddProductModal";
import AddWarehouseModal from "@/app/components/AddWarehouseModal";
import AddRackModal from "@/app/components/AddRackModal";

type ProductItem = {
  _id: string;
  name: string;
  sku: string;
  price?: number;
};

type WarehouseItem = {
  _id: string;
  name: string;
  code: string;
};

type RackItem = {
  _id: string;
  name: string;
  code: string;
  warehouseId: string | { _id: string; name: string; code: string };
};

type AddInventoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  warehouses: WarehouseItem[];
  racks: RackItem[];
  defaultProductId?: string;
  defaultWarehouseId?: string;
  defaultRackId?: string;
  isRestock?: boolean;
  onSuccess?: () => void;
  onProductsChanged?: () => void;
  onWarehousesChanged?: () => void;
  onRacksChanged?: () => void;
  zIndex?: string;
};

export default function AddInventoryModal({
  isOpen,
  onClose,
  products,
  warehouses,
  racks,
  defaultProductId = "",
  defaultWarehouseId = "",
  defaultRackId = "",
  isRestock = false,
  onSuccess,
  onProductsChanged,
  onWarehousesChanged,
  onRacksChanged,
  zIndex = "z-50",
}: AddInventoryModalProps) {
  const [productId, setProductId] = useState(defaultProductId);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [rackId, setRackId] = useState(defaultRackId);
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Sub modals
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const [isAddRackOpen, setIsAddRackOpen] = useState(false);

  useEffect(() => {
    if (defaultProductId) setProductId(defaultProductId);
    if (defaultWarehouseId) setWarehouseId(defaultWarehouseId);
    if (defaultRackId) setRackId(defaultRackId);
  }, [defaultProductId, defaultWarehouseId, defaultRackId]);

  const productOptions: SelectOption[] = useMemo(() => {
    return products.map((p) => ({
      value: p._id,
      label: p.name,
      subLabel: `SKU: ${p.sku}`,
      badge: p.price != null ? `₹${p.price.toLocaleString("en-IN")}` : undefined,
    }));
  }, [products]);

  const warehouseOptions: SelectOption[] = useMemo(() => {
    return warehouses.map((w) => ({
      value: w._id,
      label: w.name,
      subLabel: w.code,
    }));
  }, [warehouses]);

  const filteredRacks = useMemo(() => {
    if (!warehouseId) return [];
    return racks.filter((rack) => {
      const wId = typeof rack.warehouseId === "object" && rack.warehouseId ? rack.warehouseId._id : rack.warehouseId;
      return String(wId) === String(warehouseId);
    });
  }, [racks, warehouseId]);

  const rackOptions: SelectOption[] = useMemo(() => {
    return filteredRacks.map((r) => ({
      value: r._id,
      label: r.name,
      subLabel: r.code,
    }));
  }, [filteredRacks]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!productId || !warehouseId || !rackId) {
      setWarningMessage("Please select product, warehouse, and rack");
      setWarningOpen(true);
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      setWarningMessage("Quantity must be greater than 0");
      setWarningOpen(true);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          warehouseId,
          rackId,
          quantity: Number(quantity),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to add inventory");
        setWarningOpen(true);
        return;
      }

      setProductId("");
      setWarehouseId("");
      setRackId("");
      setQuantity("");

      if (onSuccess) onSuccess();
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
        <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {isRestock ? "Restock Item" : "Add Stock Entry"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isRestock
                    ? "Add additional units to existing location"
                    : "Allocate product units to a warehouse & rack"}
                </p>
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
                Product <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={productOptions}
                value={productId}
                onChange={setProductId}
                placeholder="Search & select product..."
                onAddNew={() => setIsAddProductOpen(true)}
                addNewLabel="Add Product"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Warehouse <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={warehouseOptions}
                value={warehouseId}
                onChange={(wId) => {
                  setWarehouseId(wId);
                  setRackId("");
                }}
                placeholder="Search & select warehouse..."
                onAddNew={() => setIsAddWarehouseOpen(true)}
                addNewLabel="Add Warehouse"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Rack Location <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={rackOptions}
                value={rackId}
                onChange={setRackId}
                placeholder={
                  !warehouseId
                    ? "Select warehouse first"
                    : rackOptions.length === 0
                    ? "No racks - Click to add"
                    : "Search & select rack..."
                }
                disabled={!warehouseId}
                onAddNew={warehouseId ? () => setIsAddRackOpen(true) : undefined}
                addNewLabel="Add Rack"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Quantity (Units) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
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
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-6 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {loading ? "Saving..." : isRestock ? "+ Restock Units" : "+ Add Stock Entry"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Sub modals with z-[70] */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        categories={[]}
        warehouses={warehouses}
        racks={racks}
        zIndex="z-[70]"
        onSuccess={(newProd) => {
          if (onProductsChanged) onProductsChanged();
          setProductId(newProd._id);
        }}
      />

      <AddWarehouseModal
        isOpen={isAddWarehouseOpen}
        onClose={() => setIsAddWarehouseOpen(false)}
        zIndex="z-[70]"
        onSuccess={(newWh) => {
          if (onWarehousesChanged) onWarehousesChanged();
          setWarehouseId(newWh._id);
          setRackId("");
        }}
      />

      <AddRackModal
        isOpen={isAddRackOpen}
        onClose={() => setIsAddRackOpen(false)}
        warehouses={warehouses}
        defaultWarehouseId={warehouseId}
        zIndex="z-[70]"
        onAddNewWarehouse={() => setIsAddWarehouseOpen(true)}
        onSuccess={(newRk) => {
          if (onRacksChanged) onRacksChanged();
          setRackId(newRk._id);
        }}
      />

      <WarningPopup
        open={warningOpen}
        onClose={() => setWarningOpen(false)}
        message={warningMessage}
      />
    </>
  );
}
