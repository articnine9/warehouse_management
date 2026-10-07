"use client";

import { FormEvent, useState, useMemo, useEffect, useCallback } from "react";
import { X, Tag, Warehouse as WarehouseIcon, Loader2, AlertTriangle, PackagePlus, ArrowRight, CheckCircle2 } from "lucide-react";
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

  // Duplicate product detection state
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateModalStep, setDuplicateModalStep] = useState<"CONFIRM" | "RESTOCK">("CONFIRM");
  const [existingProduct, setExistingProduct] = useState<{
    _id: string;
    name: string;
    sku: string;
    category?: string;
    price?: number;
    totalStock?: number;
  } | null>(null);

  // Restock inputs for existing product
  const [restockQuantity, setRestockQuantity] = useState("1");
  const [restockWarehouseId, setRestockWarehouseId] = useState("");
  const [restockRackId, setRestockRackId] = useState("");
  const [restockLoading, setRestockLoading] = useState(false);

  // Inline name match warning
  const [inlineExistingMatch, setInlineExistingMatch] = useState<{
    _id: string;
    name: string;
    sku: string;
    category?: string;
    price?: number;
    totalStock?: number;
  } | null>(null);

  const checkProductName = useCallback(async (productName: string) => {
    const trimmed = productName.trim();
    if (!trimmed || trimmed.length < 2) {
      setInlineExistingMatch(null);
      return;
    }
    try {
      const res = await fetch(`/api/products?checkName=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.success && data.exists && data.product) {
        setInlineExistingMatch(data.product);
      } else {
        setInlineExistingMatch(null);
      }
    } catch {
      setInlineExistingMatch(null);
    }
  }, []);

  // Debounced check on name change
  useEffect(() => {
    const timer = setTimeout(() => {
      void checkProductName(name);
    }, 450);
    return () => clearTimeout(timer);
  }, [name, checkProductName]);

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

  // Options for restock rack dropdown
  const restockFilteredRacks = useMemo(() => {
    if (!restockWarehouseId) return [];
    return racks.filter((r) => {
      const wId = typeof r.warehouseId === "object" && r.warehouseId ? r.warehouseId._id : r.warehouseId;
      return String(wId) === String(restockWarehouseId);
    });
  }, [racks, restockWarehouseId]);

  const restockRackOptions: SelectOption[] = useMemo(() => {
    return restockFilteredRacks.map((r) => ({
      value: r._id,
      label: r.name,
      subLabel: r.code,
    }));
  }, [restockFilteredRacks]);

  async function handleRestockSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!existingProduct) return;

    if (!restockWarehouseId) {
      setWarningMessage("Please select a warehouse to add stock.");
      setWarningOpen(true);
      return;
    }

    if (!restockRackId) {
      setWarningMessage("Please select a rack in the selected warehouse.");
      setWarningOpen(true);
      return;
    }

    const qty = Number(restockQuantity);
    if (!qty || qty <= 0) {
      setWarningMessage("Please enter a valid quantity greater than 0.");
      setWarningOpen(true);
      return;
    }

    setRestockLoading(true);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESTOCK_EXISTING",
          existingProductId: existingProduct._id,
          warehouseId: restockWarehouseId,
          rackId: restockRackId,
          quantity: qty,
        }),
      });

      const resData = await response.json();
      if (!resData.success) {
        setWarningMessage(resData.message || "Failed to add stock to product");
        setWarningOpen(true);
        return;
      }

      // Close duplicate modal & reset form
      setDuplicateModalOpen(false);
      setName("");
      setSku("");
      setCategory("");
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
      setInlineExistingMatch(null);

      if (onSuccess) {
        onSuccess(resData.data || existingProduct);
      }
      onClose();
    } catch (err) {
      console.error(err);
      setWarningMessage("Network error adding stock to product");
      setWarningOpen(true);
    } finally {
      setRestockLoading(false);
    }
  }

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
        if (result.isDuplicate && result.existingProduct) {
          setExistingProduct(result.existingProduct);
          setDuplicateModalStep("CONFIRM");
          const defaultWh = warehouseId || (warehouses[0]?._id ?? "");
          setRestockWarehouseId(defaultWh);
          setRestockRackId(rackId || "");
          setRestockQuantity(initialQuantity && Number(initialQuantity) > 0 ? initialQuantity : "1");
          setDuplicateModalOpen(true);
          return;
        }
        setWarningMessage(result.message || "Failed to add product");
        setWarningOpen(true);
        return;
      }

      // Reset form
      setName("");
      setSku("");
      setCategory("");
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
      setInlineExistingMatch(null);

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
                {inlineExistingMatch && (
                  <div className="mt-1.5 flex items-center justify-between gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">
                        Already exists: <strong>{inlineExistingMatch.name}</strong> ({inlineExistingMatch.sku}, {inlineExistingMatch.totalStock ?? 0} in stock)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setExistingProduct(inlineExistingMatch);
                        setDuplicateModalStep("RESTOCK");
                        const defaultWh = warehouseId || (warehouses[0]?._id ?? "");
                        setRestockWarehouseId(defaultWh);
                        setRestockRackId(rackId || "");
                        setRestockQuantity(initialQuantity && Number(initialQuantity) > 0 ? initialQuantity : "1");
                        setDuplicateModalOpen(true);
                      }}
                      className="shrink-0 font-bold text-amber-900 underline hover:text-amber-950 text-[11px]"
                    >
                      Add Stock Instead
                    </button>
                  </div>
                )}
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

      {/* ─── DUPLICATE PRODUCT CONFIRMATION & RESTOCK MODAL ─── */}
      {duplicateModalOpen && existingProduct && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            {duplicateModalStep === "CONFIRM" ? (
              <div>
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Product Already Exists!</h3>
                    <p className="text-xs text-slate-500">Same product name detected in the inventory catalog</p>
                  </div>
                </div>

                <div className="my-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Product Name</span>
                    <span className="text-sm font-bold text-slate-900">{existingProduct.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">SKU Code</span>
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded">{existingProduct.sku}</span>
                  </div>
                  {existingProduct.category && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Category</span>
                      <span className="text-xs font-medium text-slate-700">{existingProduct.category}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Current Total Stock</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded">
                      {existingProduct.totalStock ?? 0} units
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600 border border-slate-200/80">
                  <p className="font-bold text-slate-800 mb-1">Is this the same product you want to add stock to?</p>
                  <p>Click &ldquo;Yes, Same Product&rdquo; to specify quantity and warehouse rack to add stock into this existing product.</p>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateModalOpen(false);
                    }}
                    className="w-full sm:w-auto rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    No, Different Product (Change Name)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateModalStep("RESTOCK");
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                  >
                    <span>Yes, Same Product (Add Stock)</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80">
                    <PackagePlus className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Add Stock to Existing Product</h3>
                    <p className="text-xs text-slate-500">Adding stock to <strong>{existingProduct.name}</strong> ({existingProduct.sku})</p>
                  </div>
                </div>

                <form onSubmit={handleRestockSubmit} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Quantity to Add <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="e.g. 10"
                      value={restockQuantity}
                      onChange={(e) => setRestockQuantity(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Warehouse <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={warehouseOptions}
                      value={restockWarehouseId}
                      onChange={(val) => {
                        setRestockWarehouseId(val);
                        setRestockRackId("");
                      }}
                      placeholder="Select warehouse..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Rack Location <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={restockRackOptions}
                      value={restockRackId}
                      onChange={setRestockRackId}
                      placeholder={
                        !restockWarehouseId
                          ? "Select warehouse first..."
                          : restockFilteredRacks.length === 0
                          ? "No racks in this warehouse"
                          : "Select rack..."
                      }
                      disabled={!restockWarehouseId}
                    />
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setDuplicateModalStep("CONFIRM")}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={restockLoading || !restockWarehouseId || !restockRackId}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      {restockLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Adding Stock...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Confirm & Add {restockQuantity ? `${restockQuantity} Units` : "Stock"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      <WarningPopup
        open={warningOpen}
        onClose={() => setWarningOpen(false)}
        message={warningMessage}
      />
    </>
  );
}
