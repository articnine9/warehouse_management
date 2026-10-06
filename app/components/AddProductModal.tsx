"use client";

import { FormEvent, useState, useMemo } from "react";
import { X, Tag, RotateCcw, Box, Warehouse as WarehouseIcon, Loader2, Plus } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import WarningPopup from "@/app/components/WarningPopup";
import AddCategoryModal from "@/app/components/AddCategoryModal";
import AddWarehouseModal from "@/app/components/AddWarehouseModal";
import AddRackModal from "@/app/components/AddRackModal";
import { CUSTOM_INTERVAL_VALUE, normalizeIntervalMonths } from "@/lib/serviceCycle";

type CategoryItem = {
  _id: string;
  name: string;
  code: string;
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

type AddProductModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  warehouses: WarehouseItem[];
  racks: RackItem[];
  onSuccess?: (product: any) => void;
  onCategoriesChanged?: () => void;
  onWarehousesChanged?: () => void;
  onRacksChanged?: () => void;
  zIndex?: string;
};

export default function AddProductModal({
  isOpen,
  onClose,
  categories,
  warehouses,
  racks,
  onSuccess,
  onCategoriesChanged,
  onWarehousesChanged,
  onRacksChanged,
  zIndex = "z-50",
}: AddProductModalProps) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState<"NON_REUSABLE" | "REUSABLE">("NON_REUSABLE");
  const [returnDays, setReturnDays] = useState("30");
  const [serviceInterval, setServiceInterval] = useState("3");
  const [customServiceInterval, setCustomServiceInterval] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState("12");
  const [serialNumber, setSerialNumber] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  // Warehouse & Rack storage allocation
  const [warehouseId, setWarehouseId] = useState("");
  const [rackId, setRackId] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("");

  const [loading, setLoading] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Sub-modals for inline creation
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const [isAddRackOpen, setIsAddRackOpen] = useState(false);

  // Options
  const categoryOptions: SelectOption[] = useMemo(() => {
    return categories.map((c) => ({
      value: c.name,
      label: c.name,
      subLabel: c.code,
    }));
  }, [categories]);

  const warehouseOptions: SelectOption[] = useMemo(() => {
    return warehouses.map((w) => ({
      value: w._id,
      label: w.name,
      subLabel: w.code,
    }));
  }, [warehouses]);

  const filteredRacks = useMemo(() => {
    if (!warehouseId) return [];
    return racks.filter((r) => {
      const wId = typeof r.warehouseId === "object" && r.warehouseId ? r.warehouseId._id : r.warehouseId;
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

    if (warehouseId && !rackId) {
      setWarningMessage("Please select a rack for the selected warehouse.");
      setWarningOpen(true);
      return;
    }

    if (!warehouseId && initialQuantity && Number(initialQuantity) > 0) {
      setWarningMessage("Please select a warehouse and rack to assign initial stock.");
      setWarningOpen(true);
      return;
    }

    setLoading(true);

    const intervalVal = normalizeIntervalMonths(
      serviceInterval === CUSTOM_INTERVAL_VALUE ? customServiceInterval : serviceInterval
    );

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          category,
          productType,
          returnDays: productType === "REUSABLE" ? Math.max(1, Number(returnDays) || 30) : 0,
          serviceIntervalMonths: intervalVal,
          warrantyMonths: Math.max(0, Number(warrantyMonths) || 0),
          serialNumber: serialNumber.trim() || undefined,
          sellerName: sellerName.trim(),
          price: Number(price),
          description: description.trim(),
          warehouseId: warehouseId || undefined,
          rackId: rackId || undefined,
          initialQuantity: warehouseId && rackId ? Math.max(0, Number(initialQuantity) || 0) : undefined,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to add product");
        setWarningOpen(true);
        return;
      }

      // Reset form
      setName("");
      setSku("");
      setCategory("");
      setProductType("NON_REUSABLE");
      setReturnDays("30");
      setServiceInterval("3");
      setCustomServiceInterval("");
      setWarrantyMonths("12");
      setSerialNumber("");
      setSellerName("");
      setPrice("");
      setDescription("");
      setWarehouseId("");
      setRackId("");
      setInitialQuantity("");

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
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-2xl animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Tag className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Add New Product</h3>
                <p className="text-xs text-slate-500">Create a catalog product & assign storage location</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dell Latitude 5420"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  SKU Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LAP-001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Category
                </label>
                <SearchableSelect
                  options={categoryOptions}
                  value={category}
                  onChange={setCategory}
                  placeholder="Select category..."
                  onAddNew={() => setIsAddCategoryOpen(true)}
                  addNewLabel="Add Category"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Seller Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dell India, Tech Corp"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="Price in ₹"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Short product note..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Product Classification */}
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase">Product Classification</p>
                  <p className="text-[11px] text-slate-500">Normal consumable or internal returnable asset?</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 max-w-sm">
                <button
                  type="button"
                  onClick={() => setProductType("NON_REUSABLE")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-semibold transition ${
                    productType === "NON_REUSABLE"
                      ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Box className="h-3.5 w-3.5" />
                  Normal Item
                </button>
                <button
                  type="button"
                  onClick={() => setProductType("REUSABLE")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-semibold transition ${
                    productType === "REUSABLE"
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reusable Asset
                </button>
              </div>

              {productType === "REUSABLE" && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-2.5 max-w-sm">
                  <label className="block text-[11px] font-bold text-indigo-950 uppercase mb-1">
                    Return Period (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="30"
                    value={returnDays}
                    onChange={(e) => setReturnDays(e.target.value)}
                    required
                    className="w-full rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-bold text-indigo-900 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Storage Location & Initial Stock */}
            <div className="rounded-xl bg-blue-50/70 p-4 border border-blue-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-900 uppercase flex items-center gap-1.5">
                    <WarehouseIcon className="h-4 w-4 text-blue-600" />
                    Storage Location & Initial Stock (Warehouse & Rack)
                  </p>
                  <p className="text-[11px] text-blue-700/80">
                    Directly assign this product to a warehouse & rack with starting inventory (Optional).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Warehouse
                  </label>
                  <SearchableSelect
                    options={warehouseOptions}
                    value={warehouseId}
                    onChange={(val) => {
                      setWarehouseId(val);
                      setRackId("");
                    }}
                    placeholder="Select warehouse..."
                    onAddNew={() => setIsAddWarehouseOpen(true)}
                    addNewLabel="Add Warehouse"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Rack {warehouseId ? `(${filteredRacks.length})` : ""}
                  </label>
                  <SearchableSelect
                    options={rackOptions}
                    value={rackId}
                    onChange={setRackId}
                    placeholder={
                      !warehouseId
                        ? "Select warehouse first..."
                        : filteredRacks.length === 0
                        ? "No racks - Click to add"
                        : "Select rack..."
                    }
                    disabled={!warehouseId}
                    onAddNew={warehouseId ? () => setIsAddRackOpen(true) : undefined}
                    addNewLabel="Add Rack"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Initial Stock (Qty)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 10 (or 0)"
                    value={initialQuantity}
                    onChange={(e) => setInitialQuantity(e.target.value)}
                    disabled={!warehouseId || !rackId}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
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
                {loading ? "Adding..." : "+ Create Product"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Sub-modals with higher z-index (z-[70]) */}
      <AddCategoryModal
        isOpen={isAddCategoryOpen}
        onClose={() => setIsAddCategoryOpen(false)}
        zIndex="z-[70]"
        onSuccess={(newCat) => {
          if (onCategoriesChanged) onCategoriesChanged();
          setCategory(newCat.name);
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
