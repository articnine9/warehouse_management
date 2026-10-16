"use client";

import { FormEvent, useState, useMemo, useEffect, useCallback } from "react";
import { X, Tag, Warehouse as WarehouseIcon, Loader2, AlertTriangle, PackagePlus, ArrowRight, CheckCircle2, Layers } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import WarningPopup from "@/app/components/WarningPopup";
import AddCategoryModal from "@/app/components/AddCategoryModal";
import AddWarehouseModal from "@/app/components/AddWarehouseModal";
import AddZoneModal from "@/app/components/AddZoneModal";
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

type ZoneItem = {
  _id: string;
  name: string;
  code?: string;
  warehouseId?: string | { _id: string; name: string; code?: string };
};

type RackItem = {
  _id: string;
  name: string;
  code: string;
  warehouseId: string | { _id: string; name: string; code: string };
  zoneId?: string | { _id: string; name: string; code?: string };
};

type AddProductModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  warehouses: WarehouseItem[];
  zones?: ZoneItem[];
  racks: RackItem[];
  onSuccess?: (product: any) => void;
  onCategoriesChanged?: () => void;
  onWarehousesChanged?: () => void;
  onZonesChanged?: () => void;
  onRacksChanged?: () => void;
  zIndex?: string;
};

export default function AddProductModal({
  isOpen,
  onClose,
  categories,
  warehouses,
  zones = [],
  racks,
  onSuccess,
  onCategoriesChanged,
  onWarehousesChanged,
  onZonesChanged,
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

  // Warehouse, Zone & Rack storage allocation
  const [localZones, setLocalZones] = useState<ZoneItem[]>(zones || []);
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneId, setZoneId] = useState("");
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
  const [restockZoneId, setRestockZoneId] = useState("");
  const [restockRackId, setRestockRackId] = useState("");
  const [restockLoading, setRestockLoading] = useState(false);

  // Inline name match warning
  type ExistingProductMatch = {
    _id: string;
    name: string;
    sku: string;
    category?: string;
    price?: number;
    totalStock?: number;
    locations?: Array<{
      warehouseId: string;
      warehouseName: string;
      rackId: string;
      rackName: string;
      quantity: number;
    }>;
  };
  const [inlineExistingMatches, setInlineExistingMatches] = useState<ExistingProductMatch[]>([]);

  const checkProductName = useCallback(async (productName: string) => {
    const trimmed = productName.trim();
    if (!trimmed || trimmed.length < 2) {
      setInlineExistingMatches([]);
      return;
    }
    try {
      const res = await fetch(`/api/products?checkName=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.success && data.exists && Array.isArray(data.products)) {
        setInlineExistingMatches(data.products);
      } else {
        setInlineExistingMatches([]);
      }
    } catch {
      setInlineExistingMatches([]);
    }
  }, []);

  // Debounced check on name change
  useEffect(() => {
    const timer = setTimeout(() => {
      void checkProductName(name);
    }, 450);
    return () => clearTimeout(timer);
  }, [name, checkProductName]);

  function openRestockForProduct(product: ExistingProductMatch) {
    setExistingProduct(product);
    setDuplicateModalStep("RESTOCK");
    const defaultWh = warehouseId || (warehouses[0]?._id ?? "");
    setRestockWarehouseId(defaultWh);
    setRestockZoneId(zoneId || "");
    setRestockRackId(rackId || "");
    setRestockQuantity(initialQuantity && Number(initialQuantity) > 0 ? initialQuantity : "1");
    setDuplicateModalOpen(true);
  }

  // Sub-modals for inline creation
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const [isAddZoneOpen, setIsAddZoneOpen] = useState(false);
  const [isAddRackOpen, setIsAddRackOpen] = useState(false);

  // Auto-fetch zones if not passed or after updates
  const fetchLocalZones = useCallback(async () => {
    try {
      const res = await fetch("/api/zones");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setLocalZones(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch zones in AddProductModal:", err);
    }
  }, []);

  useEffect(() => {
    if (zones && zones.length > 0) {
      setLocalZones(zones);
    } else if (isOpen) {
      void fetchLocalZones();
    }
  }, [zones, isOpen, fetchLocalZones]);

  const effectiveZones = useMemo(() => {
    return zones && zones.length > 0 ? zones : localZones;
  }, [zones, localZones]);

  // Auto-select the only warehouse when there's just one
  useEffect(() => {
    if (warehouses.length === 1 && !warehouseId) {
      setWarehouseId(warehouses[0]._id);
    }
  }, [warehouses, warehouseId]);

  // Auto-select the only warehouse for restock when there's just one
  useEffect(() => {
    if (warehouses.length === 1 && !restockWarehouseId) {
      setRestockWarehouseId(warehouses[0]._id);
    }
  }, [warehouses, restockWarehouseId]);

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

  // Main form: zones filtered by warehouse
  const filteredZones = useMemo(() => {
    if (!warehouseId) return [];
    return effectiveZones.filter((z) => {
      const wId = typeof z.warehouseId === "object" && z.warehouseId ? z.warehouseId._id : z.warehouseId;
      return String(wId) === String(warehouseId);
    });
  }, [effectiveZones, warehouseId]);

  const zoneOptions: SelectOption[] = useMemo(() => {
    return filteredZones.map((z) => ({
      value: z._id,
      label: z.name,
      subLabel: z.code || undefined,
    }));
  }, [filteredZones]);

  // Auto-select zone when there is only one in the selected warehouse
  useEffect(() => {
    if (warehouseId && filteredZones.length === 1 && !zoneId) {
      setZoneId(filteredZones[0]._id);
    }
  }, [warehouseId, filteredZones, zoneId]);

  // Main form: racks filtered by warehouse AND zone
  const filteredRacks = useMemo(() => {
    if (!warehouseId) return [];
    return racks.filter((r) => {
      const wId = typeof r.warehouseId === "object" && r.warehouseId ? r.warehouseId._id : r.warehouseId;
      if (String(wId) !== String(warehouseId)) return false;
      if (zoneId) {
        const zId = typeof r.zoneId === "object" && r.zoneId ? r.zoneId._id : r.zoneId;
        return String(zId) === String(zoneId);
      }
      return true;
    });
  }, [racks, warehouseId, zoneId]);

  const rackOptions: SelectOption[] = useMemo(() => {
    return filteredRacks.map((r) => {
      const zoneName = typeof r.zoneId === "object" && r.zoneId ? r.zoneId.name : null;
      return {
        value: r._id,
        label: r.name,
        subLabel: zoneName ? `${r.code} • Zone: ${zoneName}` : r.code,
      };
    });
  }, [filteredRacks]);

  // Restock form: zones filtered by warehouse
  const restockFilteredZones = useMemo(() => {
    if (!restockWarehouseId) return [];
    return effectiveZones.filter((z) => {
      const wId = typeof z.warehouseId === "object" && z.warehouseId ? z.warehouseId._id : z.warehouseId;
      return String(wId) === String(restockWarehouseId);
    });
  }, [effectiveZones, restockWarehouseId]);

  const restockZoneOptions: SelectOption[] = useMemo(() => {
    return restockFilteredZones.map((z) => ({
      value: z._id,
      label: z.name,
      subLabel: z.code || undefined,
    }));
  }, [restockFilteredZones]);

  // Auto-select restock zone when there is only one in selected warehouse
  useEffect(() => {
    if (restockWarehouseId && restockFilteredZones.length === 1 && !restockZoneId) {
      setRestockZoneId(restockFilteredZones[0]._id);
    }
  }, [restockWarehouseId, restockFilteredZones, restockZoneId]);

  // Restock form: racks filtered by warehouse AND zone
  const restockFilteredRacks = useMemo(() => {
    if (!restockWarehouseId) return [];
    return racks.filter((r) => {
      const wId = typeof r.warehouseId === "object" && r.warehouseId ? r.warehouseId._id : r.warehouseId;
      if (String(wId) !== String(restockWarehouseId)) return false;
      if (restockZoneId) {
        const zId = typeof r.zoneId === "object" && r.zoneId ? r.zoneId._id : r.zoneId;
        return String(zId) === String(restockZoneId);
      }
      return true;
    });
  }, [racks, restockWarehouseId, restockZoneId]);

  const restockRackOptions: SelectOption[] = useMemo(() => {
    return restockFilteredRacks.map((r) => {
      const zoneName = typeof r.zoneId === "object" && r.zoneId ? r.zoneId.name : null;
      return {
        value: r._id,
        label: r.name,
        subLabel: zoneName ? `${r.code} • Zone: ${zoneName}` : r.code,
      };
    });
  }, [restockFilteredRacks]);

  async function handleRestockSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!existingProduct) return;

    if (!restockWarehouseId) {
      setWarningMessage("Please select a warehouse to add stock.");
      setWarningOpen(true);
      return;
    }

    if (!restockZoneId) {
      setWarningMessage("Please select a zone / room in the selected warehouse.");
      setWarningOpen(true);
      return;
    }

    if (!restockRackId) {
      setWarningMessage("Please select a rack in the selected zone.");
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
      setZoneId("");
      setRackId("");
      setRestockWarehouseId("");
      setRestockZoneId("");
      setRestockRackId("");
      setInitialQuantity("");
      setInlineExistingMatches([]);

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

    if (!category || category.trim() === "") {
      setWarningMessage("Please select or enter a product category.");
      setWarningOpen(true);
      return;
    }

    if (!warehouseId) {
      setWarningMessage("Please select a warehouse for storage.");
      setWarningOpen(true);
      return;
    }

    if (!zoneId) {
      setWarningMessage("Please select a zone / room in the selected warehouse.");
      setWarningOpen(true);
      return;
    }

    if (!rackId) {
      setWarningMessage("Please select a rack in the selected zone.");
      setWarningOpen(true);
      return;
    }

    if (!initialQuantity || initialQuantity.trim() === "" || Number(initialQuantity) <= 0) {
      setWarningMessage("Please enter a valid initial stock quantity (at least 1).");
      setWarningOpen(true);
      return;
    }

    setLoading(true);

    const intervalVal = normalizeIntervalMonths(
      serviceInterval === CUSTOM_INTERVAL_VALUE ? customServiceInterval : serviceInterval
    );

    const selectedCat = categories.find((c) => c.name.toLowerCase() === category.trim().toLowerCase());
    const categoryId = selectedCat?._id;

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          category: category.trim(),
          categoryId,
          serviceIntervalMonths: intervalVal,
          warrantyMonths: Math.max(0, Number(warrantyMonths) || 0),
          serialNumber: serialNumber.trim() || undefined,
          sellerName: sellerName.trim() || undefined,
          price: price !== "" && !isNaN(Number(price)) ? Number(price) : 0,
          description: description.trim(),
          warehouseId,
          rackId,
          initialQuantity: Math.max(1, Number(initialQuantity) || 1),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        if (result.isDuplicate && result.existingProduct) {
          setExistingProduct(result.existingProduct);
          setDuplicateModalStep("CONFIRM");
          const defaultWh = warehouseId || (warehouses[0]?._id ?? "");
          setRestockWarehouseId(defaultWh);
          setRestockZoneId(zoneId || "");
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
      setZoneId("");
      setRackId("");
      setRestockWarehouseId("");
      setRestockZoneId("");
      setRestockRackId("");
      setInitialQuantity("");
      setInlineExistingMatches([]);

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
                {inlineExistingMatches.length > 0 && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white overflow-hidden animate-in fade-in duration-150 shadow-sm">
                    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200 bg-slate-50">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                        Similar products already exist
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {inlineExistingMatches.map((match) => (
                        <div
                          key={match._id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-bold text-slate-900 break-words">{match.name}</span>
                              <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded shrink-0">
                                {match.sku}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {match.locations && match.locations.length > 0 ? (
                                <span>
                                  {match.locations.map((loc, i) => (
                                    <span key={loc.warehouseId + loc.rackId}>
                                      {i > 0 && ", "}
                                      {loc.warehouseName} / {loc.rackName} ({loc.quantity})
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span className="text-slate-400">No stock locations</span>
                              )}
                              {match.totalStock ? (
                                <span className="ml-1.5 font-semibold text-emerald-700">
                                  · Total: {match.totalStock} units
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openRestockForProduct(match)}
                            className="shrink-0 inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 transition shadow-sm"
                          >
                            <PackagePlus className="h-3 w-3" />
                            Add Stock
                          </button>
                        </div>
                      ))}
                    </div>
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
                  Category <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={categoryOptions}
                  value={category}
                  onChange={setCategory}
                  placeholder="Select category..."
                  required
                  onAddNew={() => setIsAddCategoryOpen(true)}
                  addNewLabel="Add Category"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Seller Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dell India, Tech Corp"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Price (₹) (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
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
                    Storage Location & Initial Stock (Warehouse ➔ Zone ➔ Rack) <span className="text-red-500">*</span>
                  </p>
                  <p className="text-[11px] text-blue-700/80">
                    Assign this product to a warehouse, room/zone & rack with initial inventory (Required).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Warehouse */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Warehouse <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={warehouseOptions}
                    value={warehouseId}
                    onChange={(val) => {
                      setWarehouseId(val);
                      setZoneId("");
                      setRackId("");
                    }}
                    placeholder="Select warehouse..."
                    onAddNew={() => setIsAddWarehouseOpen(true)}
                    addNewLabel="Add Warehouse"
                    required
                  />
                </div>

                {/* 2. Zone / Room */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Zone / Room {warehouseId ? `(${filteredZones.length})` : ""} <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={zoneOptions}
                    value={zoneId}
                    onChange={(val) => {
                      setZoneId(val);
                      setRackId("");
                    }}
                    placeholder={
                      !warehouseId
                        ? "Select warehouse first..."
                        : filteredZones.length === 0
                        ? "No zones - Click to add"
                        : "Select zone / room..."
                    }
                    disabled={!warehouseId}
                    onAddNew={warehouseId ? () => setIsAddZoneOpen(true) : undefined}
                    addNewLabel="Add Zone"
                    required
                  />
                </div>

                {/* 3. Rack */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Rack {zoneId ? `(${filteredRacks.length})` : ""} <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={rackOptions}
                    value={rackId}
                    onChange={setRackId}
                    placeholder={
                      !warehouseId
                        ? "Select warehouse first..."
                        : !zoneId
                        ? "Select zone first..."
                        : filteredRacks.length === 0
                        ? "No racks - Click to add"
                        : "Select rack..."
                    }
                    disabled={!warehouseId || !zoneId}
                    onAddNew={warehouseId && zoneId ? () => setIsAddRackOpen(true) : undefined}
                    addNewLabel="Add Rack"
                    required
                  />
                </div>

                {/* 4. Initial Stock */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Initial Stock (Qty) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 10"
                    value={initialQuantity}
                    onChange={(e) => setInitialQuantity(e.target.value)}
                    disabled={!warehouseId || !zoneId || !rackId}
                    required
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

      {/* Sub-modals with higher z-index */}
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
          setZoneId("");
          setRackId("");
        }}
      />

      <AddZoneModal
        isOpen={isAddZoneOpen}
        onClose={() => setIsAddZoneOpen(false)}
        warehouses={warehouses}
        defaultWarehouseId={warehouseId}
        zIndex="z-[75]"
        onSuccess={(newZone) => {
          if (onZonesChanged) onZonesChanged();
          void fetchLocalZones();
          setZoneId(newZone._id);
          setRackId("");
        }}
      />

      <AddRackModal
        isOpen={isAddRackOpen}
        onClose={() => setIsAddRackOpen(false)}
        warehouses={warehouses}
        zones={effectiveZones}
        defaultWarehouseId={warehouseId}
        defaultZoneId={zoneId}
        zIndex="z-[75]"
        onAddNewWarehouse={() => setIsAddWarehouseOpen(true)}
        onAddNewZone={() => setIsAddZoneOpen(true)}
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
                        setRestockZoneId("");
                        setRestockRackId("");
                      }}
                      placeholder="Select warehouse..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Zone / Room {restockWarehouseId ? `(${restockFilteredZones.length})` : ""} <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={restockZoneOptions}
                      value={restockZoneId}
                      onChange={(val) => {
                        setRestockZoneId(val);
                        setRestockRackId("");
                      }}
                      placeholder={
                        !restockWarehouseId
                          ? "Select warehouse first..."
                          : restockFilteredZones.length === 0
                          ? "No zones in this warehouse"
                          : "Select zone / room..."
                      }
                      disabled={!restockWarehouseId}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Rack Location {restockZoneId ? `(${restockFilteredRacks.length})` : ""} <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={restockRackOptions}
                      value={restockRackId}
                      onChange={setRestockRackId}
                      placeholder={
                        !restockWarehouseId
                          ? "Select warehouse first..."
                          : !restockZoneId
                          ? "Select zone first..."
                          : restockFilteredRacks.length === 0
                          ? "No racks in this zone"
                          : "Select rack..."
                      }
                      disabled={!restockWarehouseId || !restockZoneId}
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
                      disabled={restockLoading || !restockWarehouseId || !restockZoneId || !restockRackId}
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
