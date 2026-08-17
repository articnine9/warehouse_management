"use client";

import { useEffect, useState, useRef } from "react";
import { X, Search, MapPin, Receipt, Printer, RefreshCw } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";

type InventoryItem = {
  _id: string;
  productId: {
    _id: string;
    name: string;
    sku: string;
    category?: string;
    price?: number;
    sellerName?: string;
  };
  warehouseId: {
    _id: string;
    name: string;
    code: string;
  };
  rackId: {
    _id: string;
    name: string;
    code: string;
  };
  quantity: number;
  status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
};

type SelectedLineItem = {
  inventoryId: string;
  productName: string;
  sku: string;
  warehouseName: string;
  rackName: string;
  unitPrice: number;
  maxStock: number;
  quantity: number;
  total: number;
};

type Invoice = {
  _id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: {
    inventoryId: string;
    productId: string;
    productName: string;
    sku: string;
    warehouseName: string;
    rackName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: "CASH" | "UPI" | "CARD" | "CREDIT";
  notes?: string;
  createdAt: string;
};

export default function BillingPage() {
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Bill creation state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD" | "CREDIT">("CASH");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");

  // Line item selection state & type-to-search
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [itemQuantity, setItemQuantity] = useState("1");
  const [lineItems, setLineItems] = useState<SelectedLineItem[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Print Modal state
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch inventory with stock available
  async function fetchInventory() {
    try {
      const response = await fetch("/api/inventory");
      const result = await response.json();
      if (result.success) {
        setInventoryList(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
    }
  }

  // Fetch billing history
  async function fetchInvoices() {
    try {
      setLoading(true);
      const response = await fetch("/api/billing");
      const result = await response.json();
      if (result.success) {
        setInvoices(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInventory();
    fetchInvoices();
  }, []);

  const availableInventories = inventoryList.filter((inv) => inv.quantity > 0);
  const currentSelectedInv = inventoryList.find((inv) => inv._id === selectedInventoryId);

  // Filtered available inventories based on search query
  const matchingInventories = availableInventories.filter((inv) => {
    if (!productSearchQuery.trim()) return true;
    const q = productSearchQuery.toLowerCase().trim();
    const pName = inv.productId?.name?.toLowerCase() || "";
    const pSku = inv.productId?.sku?.toLowerCase() || "";
    const pCat = inv.productId?.category?.toLowerCase() || "";
    const pSeller = inv.productId?.sellerName?.toLowerCase() || "";
    const wName = inv.warehouseId?.name?.toLowerCase() || "";
    const wCode = inv.warehouseId?.code?.toLowerCase() || "";
    const rName = inv.rackId?.name?.toLowerCase() || "";
    return (
      pName.includes(q) ||
      pSku.includes(q) ||
      pCat.includes(q) ||
      pSeller.includes(q) ||
      wName.includes(q) ||
      wCode.includes(q) ||
      rName.includes(q)
    );
  });

  function handleSelectInventory(inv: InventoryItem) {
    setSelectedInventoryId(inv._id);
    setProductSearchQuery(`${inv.productId.name} (${inv.productId.sku}) - ₹${inv.productId.price || 0}`);
    setIsDropdownOpen(false);
    setItemQuantity("1");
    // Auto focus quantity input for fast entry
    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 50);
  }

  function handleClearProductSelection() {
    setSelectedInventoryId("");
    setProductSearchQuery("");
    setIsDropdownOpen(true);
  }

  // Add line item to bill
  function handleAddLineItem() {
    if (!currentSelectedInv) {
      alert("Please select a product from inventory");
      return;
    }

    const qty = Number(itemQuantity);
    if (!qty || qty <= 0) {
      alert("Please enter a valid quantity");
      return;
    }

    // Check if already in lineItems
    const existingIndex = lineItems.findIndex((li) => li.inventoryId === currentSelectedInv._id);
    const existingQty = existingIndex >= 0 ? lineItems[existingIndex].quantity : 0;

    if (existingQty + qty > currentSelectedInv.quantity) {
      alert(
        `Cannot add ${qty} units. Total requested (${existingQty + qty}) exceeds available stock (${currentSelectedInv.quantity}).`
      );
      return;
    }

    const unitPrice = Number(currentSelectedInv.productId.price) || 0;

    if (existingIndex >= 0) {
      const updated = [...lineItems];
      const newQty = updated[existingIndex].quantity + qty;
      updated[existingIndex].quantity = newQty;
      updated[existingIndex].total = newQty * unitPrice;
      setLineItems(updated);
    } else {
      setLineItems([
        ...lineItems,
        {
          inventoryId: currentSelectedInv._id,
          productName: currentSelectedInv.productId.name,
          sku: currentSelectedInv.productId.sku,
          warehouseName: currentSelectedInv.warehouseId.name,
          rackName: currentSelectedInv.rackId.name,
          unitPrice,
          maxStock: currentSelectedInv.quantity,
          quantity: qty,
          total: qty * unitPrice,
        },
      ]);
    }

    setSelectedInventoryId("");
    setProductSearchQuery("");
    setItemQuantity("1");
  }

  function handleRemoveLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const discountNum = Number(discount) || 0;
  const grandTotal = Math.max(0, subtotal - discountNum);

  // Submit bill and dispatch stock
  async function handleGenerateBill(e: React.FormEvent) {
    e.preventDefault();

    if (!customerName.trim()) {
      alert("Please enter customer name");
      return;
    }

    if (lineItems.length === 0) {
      alert("Please add at least one product to the bill");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerAddress,
          paymentMethod,
          discount: discountNum,
          notes,
          items: lineItems.map((li) => ({
            inventoryId: li.inventoryId,
            quantity: li.quantity,
          })),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.message || "Failed to generate bill");
        return;
      }

      // Reset form
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setLineItems([]);
      setDiscount("0");
      setNotes("");

      // Open print preview modal for the generated invoice
      setActiveInvoice(result.data);

      // Refresh inventory and invoice history
      await fetchInventory();
      await fetchInvoices();
    } catch (error) {
      console.error("Billing error:", error);
      alert("Something went wrong while processing the bill");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6 print:p-0 print:bg-white">
      {/* Header (Hidden on Print) */}
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Billing & Stock Dispatch</h1>
        <p className="mt-1 text-sm text-slate-500">
          Dispatch stock to customers, auto-deduct inventory, generate invoices.
        </p>
      </div>

      {/* Main Billing Form Grid (Hidden on Print) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 print:hidden">
        {/* Left 2 Cols: Customer & Product Items */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Customer Details */}
          <div className="rounded-xl bg-white p-4 md:p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Customer Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Kumar"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Address / City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nagercoil, TN"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          {/* Add Line Items Section */}
          <div className="rounded-xl bg-white p-4 md:p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Add Products to Bill</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              {/* Type-to-Search Product Combobox */}
              <div className="md:col-span-2 relative" ref={dropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600 uppercase">
                    Select Available Product *
                  </label>
                  {selectedInventoryId && (
                    <button
                      type="button"
                      onClick={handleClearProductSelection}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Change Product
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type to search (e.g. Laptop, Mouse, WM-001)..."
                    value={productSearchQuery}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      if (selectedInventoryId) {
                        setSelectedInventoryId("");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setIsDropdownOpen(false);
                    }}
                    className={`w-full rounded-lg border bg-white px-4 py-2.5 pr-10 text-sm outline-none transition ${
                      selectedInventoryId
                        ? "border-blue-500 ring-2 ring-blue-500/10 font-medium text-slate-900 bg-blue-50/20"
                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    }`}
                  />
                  {productSearchQuery ? (
                    <button
                      type="button"
                      onClick={handleClearProductSelection}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      title="Clear selection"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Search className="h-4 w-4" />
                    </span>
                  )}
                </div>

                {/* Dropdown Options List */}
                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    <div className="p-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50 flex justify-between">
                      <span>Available Stock ({matchingInventories.length})</span>
                      <span>Click to Select</span>
                    </div>

                    {matchingInventories.map((inv) => (
                      <div
                        key={inv._id}
                        onClick={() => handleSelectInventory(inv)}
                        className={`p-3 border-b border-slate-50 cursor-pointer transition hover:bg-blue-50/60 ${
                          selectedInventoryId === inv._id ? "bg-blue-50 border-blue-100" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">
                              {inv.productId.name}
                              <span className="ml-1.5 text-xs text-slate-400 font-normal">
                                ({inv.productId.sku})
                              </span>
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {inv.warehouseId.name} • Rack {inv.rackId.name} ({inv.rackId.code})
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900 text-sm">
                              ₹{Number(inv.productId.price || 0).toLocaleString("en-IN")}
                            </span>
                            <span className="block text-[11px] font-semibold text-emerald-600 mt-0.5">
                              Stock: {inv.quantity}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {matchingInventories.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No available products found matching &ldquo;{productSearchQuery}&rdquo;
                      </div>
                    )}
                  </div>
                )}

                {/* Current Selected Details Pill */}
                {currentSelectedInv && !isDropdownOpen && (
                  <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span>
                      Unit Price: <b className="text-slate-900">₹{currentSelectedInv.productId.price?.toLocaleString("en-IN")}</b>
                    </span>
                    <span>•</span>
                    <span>
                      Available Stock: <b className="text-emerald-700">{currentSelectedInv.quantity} units</b>
                    </span>
                    <span>•</span>
                    <span>
                      Location: <b className="text-slate-700">{currentSelectedInv.warehouseId.code} ({currentSelectedInv.rackId.name})</b>
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Quantity {currentSelectedInv ? `(Max: ${currentSelectedInv.quantity})` : ""}
                </label>
                <input
                  ref={quantityInputRef}
                  type="number"
                  min="1"
                  max={currentSelectedInv?.quantity || 9999}
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddLineItem();
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="w-full rounded-lg bg-emerald-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition"
                >
                  + Add Item
                </button>
              </div>
            </div>

            {/* Added Items — Desktop Table */}
            <div className="mt-4 hidden overflow-x-auto border border-slate-200 rounded-lg md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">Location</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-800">
                        {item.productName}
                        <span className="block text-xs text-slate-400">SKU: {item.sku}</span>
                      </td>
                      <td className="p-3 text-xs text-slate-500">{item.warehouseName} &bull; {item.rackName}</td>
                      <td className="p-3 text-right font-medium text-slate-700">₹{item.unitPrice.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-center font-bold text-slate-800">{item.quantity}</td>
                      <td className="p-3 text-right font-semibold text-slate-800">₹{item.total.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-center">
                        <button type="button" onClick={() => handleRemoveLineItem(idx)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 inline-flex items-center gap-0.5">
                          <X className="h-3 w-3" /> Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {lineItems.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-sm text-slate-400">
                      No items added yet. Select a product above and click &quot;+ Add Item&quot;.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Added Items — Mobile Cards */}
            <div className="mt-4 space-y-2 md:hidden">
              {lineItems.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{item.productName}</p>
                      <p className="text-xs text-slate-400">{item.sku} • {item.warehouseName}</p>
                    </div>
                    <button type="button" onClick={() => handleRemoveLineItem(idx)}
                      className="text-red-500 text-xs font-semibold inline-flex items-center">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">₹{item.unitPrice.toLocaleString("en-IN")} × {item.quantity}</span>
                    <span className="font-bold text-slate-800">₹{item.total.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              ))}
              {lineItems.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">No items added yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Summary & Payment */}
        <div className="space-y-4 md:space-y-6">
          <div className="rounded-xl bg-white p-4 md:p-6 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Bill Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({lineItems.length} items):</span>
                <span className="font-semibold text-slate-800">₹{subtotal.toLocaleString("en-IN")}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Discount (₹)</label>
                <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-right outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="CREDIT">Store Credit / Pay Later</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Notes (Optional)</label>
                <textarea rows={2} placeholder="e.g. Delivered via Van 1" value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-lg font-bold text-slate-800">
                <span>Grand Total:</span>
                <span className="text-emerald-600">₹{grandTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <button type="button" disabled={submitting || lineItems.length === 0} onClick={handleGenerateBill}
              className="w-full rounded-lg bg-blue-600 py-3 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition">
              {submitting ? "Processing..." : <span className="inline-flex items-center gap-1.5"><Receipt className="h-4 w-4" /> Generate Bill & Dispatch</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Invoice History Section (Hidden on Print) */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-200 print:hidden">
        <div className="border-b border-slate-100 px-4 py-4 md:px-6 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Recent Invoices</h2>
            <p className="text-xs text-slate-500 mt-0.5">View and reprint past sales invoices</p>
          </div>
          <button onClick={fetchInvoices} className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Invoice #</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3">Payment</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv._id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-bold text-blue-600">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {inv.customerName}
                    {inv.customerPhone && <span className="block text-xs text-slate-400">{inv.customerPhone}</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{inv.items.length} items</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{inv.paymentMethod}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800">₹{inv.grandTotal.toLocaleString("en-IN")}</td>
                   <td className="px-5 py-3 text-center">
                     <button type="button" onClick={() => setActiveInvoice(inv)}
                       className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 inline-flex items-center gap-1">
                       <Printer className="h-3.5 w-3.5" /> Print
                     </button>
                   </td>
                </tr>
              ))}
              {!loading && invoices.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">No invoices generated yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 p-4 md:hidden">
          {invoices.map((inv) => (
            <div key={inv._id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-blue-600 text-sm">{inv.invoiceNumber}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className="font-bold text-slate-800 text-sm">₹{inv.grandTotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{inv.customerName} • {inv.items.length} items</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{inv.paymentMethod}</span>
              </div>
              <div className="mt-2">
                <button type="button" onClick={() => setActiveInvoice(inv)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50 inline-flex items-center gap-1">
                  <Printer className="h-3.5 w-3.5" /> View / Print
                </button>
              </div>
            </div>
          ))}
          {!loading && invoices.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">No invoices generated yet.</p>
          )}
        </div>
      </div>

      {/* Invoice Print & Preview Modal */}
      {activeInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:p-0 print:static print:bg-transparent">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl p-8 max-h-[95vh] overflow-y-auto print:max-w-none print:shadow-none print:p-0 print:h-auto">
            {/* Modal Actions (Hidden when Printing) */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 print:hidden mb-6">
              <span className="text-sm font-semibold text-slate-500">Invoice Preview</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition"
                >
                  <Printer className="h-4 w-4" /> Print Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInvoice(null)}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition inline-flex items-center gap-1"
                >
                  <X className="h-4 w-4" /> Close
                </button>
              </div>
            </div>

            {/* Printable Bill Area */}
            <div className="space-y-6 text-slate-900 print:space-y-4">
              {/* Company & Invoice Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">
                    WAREHOUSE MANAGEMENT
                  </h1>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Official Dispatch Slip & Tax Invoice
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-slate-900 text-white font-mono text-sm font-bold px-3 py-1 rounded">
                    {activeInvoice.invoiceNumber}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    Date:{" "}
                    {new Date(activeInvoice.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Billed To / Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Billed To:</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {activeInvoice.customerName}
                  </p>
                  {activeInvoice.customerPhone && (
                    <p className="text-slate-600 mt-0.5">Phone: {activeInvoice.customerPhone}</p>
                  )}
                  {activeInvoice.customerAddress && (
                    <p className="text-slate-600 mt-0.5">Address: {activeInvoice.customerAddress}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Payment Details:</p>
                  <p className="text-xs font-semibold text-slate-900 mt-0.5">
                    Mode: {activeInvoice.paymentMethod}
                  </p>
                  <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                    Status: DISPATCHED / PAID
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                    <th className="p-2 border-r border-slate-300">#</th>
                    <th className="p-2 border-r border-slate-300">Item Description</th>
                    <th className="p-2 border-r border-slate-300">Source Location</th>
                    <th className="p-2 text-right border-r border-slate-300">Unit Price</th>
                    <th className="p-2 text-center border-r border-slate-300">Qty</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {activeInvoice.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 text-slate-500 border-r border-slate-200">{idx + 1}</td>
                      <td className="p-2 font-medium text-slate-900 border-r border-slate-200">
                        {item.productName}
                        <span className="block text-[10px] text-slate-400">SKU: {item.sku}</span>
                      </td>
                      <td className="p-2 text-slate-600 border-r border-slate-200">
                        {item.warehouseName} &bull; {item.rackName}
                      </td>
                      <td className="p-2 text-right text-slate-700 border-r border-slate-200">
                        ₹{item.unitPrice.toLocaleString("en-IN")}
                      </td>
                      <td className="p-2 text-center font-bold border-r border-slate-200">
                        {item.quantity}
                      </td>
                      <td className="p-2 text-right font-semibold text-slate-900">
                        ₹{item.total.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Calculation Grid */}
              <div className="flex justify-end text-xs">
                <div className="w-60 space-y-1.5 border-t-2 border-slate-900 pt-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-900">
                      ₹{activeInvoice.subtotal.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {activeInvoice.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount:</span>
                      <span>-₹{activeInvoice.discount.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-300 pt-1.5">
                    <span>Grand Total:</span>
                    <span className="text-emerald-700">
                      ₹{activeInvoice.grandTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures & Footer */}
              <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-[11px] text-slate-500">
                <div>
                  <p>Thank you for your business!</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Items received in good condition.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-36 border-b border-slate-400 pb-8"></div>
                  <p className="mt-1 font-semibold text-slate-700">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </ProtectedPage>
  );
}
