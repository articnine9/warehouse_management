"use client";

import { useEffect, useState, useMemo, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Search, X, UserPlus, KeyRound, Eye, EyeOff } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import { useAuth } from "@/app/components/AuthProvider";
import WarningPopup from "@/app/components/WarningPopup";

type WarehouseOption = {
  _id: string;
  name: string;
  code: string;
};

type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  warehouse: { id: string; name: string; code: string; address?: string } | null;
  warehouses?: { id: string; name: string; code: string; address?: string }[];
  status?: "ACTIVE" | "INACTIVE";
};

type StaffInventoryItem = {
  id: string;
  productName: string;
  sku: string;
  category: string;
  price: number | null;
  sellerName: string;
  rackName: string;
  rackCode: string;
  quantity: number;
  status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
  warehouseName: string;
  warehouseCode: string;
};

type WarehouseSummary = {
  totalUnits: number;
  distinctProducts: number;
  availableCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  attentionCount: number;
};

function StaffContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialStatusParam = searchParams.get("status") || "ALL";

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [staffStock, setStaffStock] = useState<StaffInventoryItem[]>([]);
  const [summary, setSummary] = useState<WarehouseSummary | null>(null);
  const [warehouseInfo, setWarehouseInfo] = useState<{ name: string; code: string; address?: string } | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>(
    initialStatusParam === "attention" ? "ATTENTION" : initialStatusParam
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Add staff form state
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<"STAFF" | "ADMIN">("STAFF");
  const [addWarehouseSelection, setAddWarehouseSelection] = useState<string>("ALL");
  const [addLoading, setAddLoading] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);

  // Edit staff modal state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"STAFF" | "ADMIN">("STAFF");
  const [editWarehouseSelection, setEditWarehouseSelection] = useState<string>("ALL");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Pagination states
  const [staffPage, setStaffPage] = useState(1);
  const [staffPageSize, setStaffPageSize] = useState(10);

  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(10);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  useEffect(() => {
    const param = searchParams.get("status");
    if (param === "attention") {
      setStatusFilter("ATTENTION");
    } else if (param) {
      setStatusFilter(param);
    }
  }, [searchParams]);

  async function fetchStaffView() {
    try {
      setLoading(true);
      const response = await fetch("/api/staff", { cache: "no-store" });
      const result = await response.json();
      if (!result.success) return;

      if (result.role === "ADMIN") {
        setStaff(result.data || []);
        return;
      }

      setStaffStock(result.data.items || []);
      setSummary(result.data.summary || null);
      setWarehouseInfo(result.data.warehouse || null);
    } catch (error) {
      console.error("Failed to fetch staff page:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWarehouses() {
    try {
      const response = await fetch("/api/warehouses");
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setWarehouses(result.data);
        if (result.data.length >= 2) {
          setAddWarehouseSelection((prev) => (prev ? prev : "ALL"));
        } else if (result.data.length > 0) {
          setAddWarehouseSelection((prev) => (prev ? prev : result.data[0]._id));
        }
      }
    } catch (error) {
      console.error("Failed to fetch warehouses:", error);
    }
  }

  useEffect(() => {
    void fetchStaffView();
    void fetchWarehouses();
  }, []);

  async function handleAddStaffSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim() || !addPassword.trim()) {
      setWarningMessage("Name, email, and password are required");
      setWarningOpen(true);
      return;
    }

    const assignedWarehouseIds =
      addRole === "STAFF"
        ? addWarehouseSelection === "ALL"
          ? warehouses.map((w) => w._id)
          : addWarehouseSelection
          ? [addWarehouseSelection]
          : []
        : [];

    if (addRole === "STAFF" && assignedWarehouseIds.length === 0) {
      setWarningMessage("Please select an assigned warehouse for this staff member");
      setWarningOpen(true);
      return;
    }

    setAddLoading(true);

    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          email: addEmail.trim(),
          password: addPassword.trim(),
          role: addRole,
          warehouseId: assignedWarehouseIds[0] || undefined,
          warehouseIds: assignedWarehouseIds,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to create staff member");
        setWarningOpen(true);
        return;
      }

      // Reset form
      setAddName("");
      setAddEmail("");
      setAddPassword("");
      setAddRole("STAFF");
      setAddWarehouseSelection(warehouses.length >= 2 ? "ALL" : (warehouses[0]?._id || ""));
      await fetchStaffView();
    } catch (error) {
      console.error("Failed to create staff:", error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setAddLoading(false);
    }
  }

  function openEditModal(member: StaffMember) {
    setEditId(member.id);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditRole(member.role);

    const memberWhIds =
      member.warehouses && member.warehouses.length > 0
        ? member.warehouses.map((w) => w.id)
        : member.warehouse?.id
        ? [member.warehouse.id]
        : [];

    if (
      memberWhIds.length > 1 ||
      (warehouses.length >= 2 && memberWhIds.length >= warehouses.length)
    ) {
      setEditWarehouseSelection("ALL");
    } else if (memberWhIds.length === 1) {
      setEditWarehouseSelection(memberWhIds[0]);
    } else {
      setEditWarehouseSelection(warehouses.length >= 2 ? "ALL" : (warehouses[0]?._id || ""));
    }

    setEditStatus(member.status || "ACTIVE");
    setEditPassword("");
    setShowEditPassword(false);
  }

  async function handleEditStaffSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editId) return;

    if (!editName.trim() || !editEmail.trim()) {
      setWarningMessage("Name and email are required");
      setWarningOpen(true);
      return;
    }

    const assignedWarehouseIds =
      editRole === "STAFF"
        ? editWarehouseSelection === "ALL"
          ? warehouses.map((w) => w._id)
          : editWarehouseSelection
          ? [editWarehouseSelection]
          : []
        : [];

    if (editRole === "STAFF" && assignedWarehouseIds.length === 0) {
      setWarningMessage("Please select an assigned warehouse for staff members");
      setWarningOpen(true);
      return;
    }

    if (editPassword && editPassword.length < 6) {
      setWarningMessage("New password must be at least 6 characters");
      setWarningOpen(true);
      return;
    }

    setEditLoading(true);

    try {
      const response = await fetch(`/api/staff/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
          role: editRole,
          warehouseId: assignedWarehouseIds[0] || undefined,
          warehouseIds: assignedWarehouseIds,
          status: editStatus,
          password: editPassword.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to update staff member");
        setWarningOpen(true);
        return;
      }

      setEditId(null);
      await fetchStaffView();
    } catch (error) {
      console.error("Failed to edit staff:", error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/staff/${deleteId}`, { method: "DELETE" });
      const result = await response.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to delete staff");
        setWarningOpen(true);
        return;
      }
      setDeleteId(null);
      setStaff(staff.filter((member) => member.id !== deleteId));
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  }

  function statusBadge(status: string) {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "LOW_STOCK":
        return "bg-amber-50 text-amber-700 border border-amber-200";
      default:
        return "bg-red-50 text-red-700 border border-red-200";
    }
  }

  // Filtered staff members for admin
  const filteredStaff = useMemo(() => {
    if (!staffSearchQuery.trim()) return staff;
    const q = staffSearchQuery.toLowerCase().trim();
    return staff.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        (m.warehouse?.name && m.warehouse.name.toLowerCase().includes(q)) ||
        (m.warehouse?.code && m.warehouse.code.toLowerCase().includes(q))
    );
  }, [staff, staffSearchQuery]);

  useEffect(() => {
    setStaffPage(1);
  }, [staffSearchQuery, staffPageSize]);

  const paginatedStaff = useMemo(() => {
    const start = (staffPage - 1) * staffPageSize;
    return filteredStaff.slice(start, start + staffPageSize);
  }, [filteredStaff, staffPage, staffPageSize]);

  // Filtered items for staff warehouse
  const filteredStaffStock = useMemo(() => {
    return staffStock.filter((item) => {
      let matchesStatus = true;
      if (statusFilter === "AVAILABLE") matchesStatus = item.status === "AVAILABLE";
      else if (statusFilter === "LOW_STOCK") matchesStatus = item.status === "LOW_STOCK";
      else if (statusFilter === "OUT_OF_STOCK") matchesStatus = item.status === "OUT_OF_STOCK";
      else if (statusFilter === "ATTENTION")
        matchesStatus = item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK";

      let matchesSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        matchesSearch =
          item.productName.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.sellerName.toLowerCase().includes(q) ||
          item.rackName.toLowerCase().includes(q) ||
          item.rackCode.toLowerCase().includes(q);
      }

      return matchesStatus && matchesSearch;
    });
  }, [staffStock, statusFilter, searchQuery]);

  useEffect(() => {
    setStockPage(1);
  }, [statusFilter, searchQuery, stockPageSize]);

  const paginatedStaffStock = useMemo(() => {
    const start = (stockPage - 1) * stockPageSize;
    return filteredStaffStock.slice(start, start + stockPageSize);
  }, [filteredStaffStock, stockPage, stockPageSize]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
      {user?.role === "ADMIN" ? (
        <>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Staff Management</h1>
            <p className="mt-1 text-sm text-slate-500">
              Create, manage, and edit staff accounts and their warehouse assignments ({staff.length} team members)
            </p>
          </div>

          {/* Add Staff Member Form */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-800">Add New Staff Member</h2>
            </div>

            <form
              onSubmit={handleAddStaffSubmit}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Kumar"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email Address *</label>
                  <input
                    type="email"
                    placeholder="e.g. rahul@warehouse.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Account Password *</label>
                  <div className="relative">
                    <input
                      type={showAddPassword ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      value={addPassword}
                      onChange={(e) => setAddPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddPassword(!showAddPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      title={showAddPassword ? "Hide password" : "Show password"}
                    >
                      {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Role *</label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as "STAFF" | "ADMIN")}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="STAFF">STAFF (Warehouse Access)</option>
                    <option value="ADMIN">ADMIN (Full System Access)</option>
                  </select>
                </div>
              </div>

              {/* Assigned Warehouse Radio Selection */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Assigned Warehouse {addRole === "STAFF" ? "*" : "(Optional)"}
                    </label>
                    <span className="text-[11px] text-slate-500">
                      (Select individual warehouse or &quot;Both Warehouses&quot;)
                    </span>
                  </div>

                  {addRole === "ADMIN" ? (
                    <p className="text-xs text-slate-500 italic">
                      Administrators automatically have access to all warehouses.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {warehouses.map((w) => {
                        const isSelected = addWarehouseSelection === w._id;
                        return (
                          <label
                            key={w._id}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium cursor-pointer transition select-none ${
                              isSelected
                                ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20 shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="radio"
                              name="addWarehouseSelection"
                              value={w._id}
                              checked={isSelected}
                              onChange={() => setAddWarehouseSelection(w._id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                            />
                            <span className="font-semibold text-slate-800">{w.name}</span>
                            <span className="text-[11px] text-slate-400">({w.code})</span>
                          </label>
                        );
                      })}

                      {warehouses.length >= 2 && (
                        <label
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition select-none ${
                            addWarehouseSelection === "ALL"
                              ? "border-purple-600 bg-purple-50 text-purple-700 ring-2 ring-purple-500/20 shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="addWarehouseSelection"
                            value="ALL"
                            checked={addWarehouseSelection === "ALL"}
                            onChange={() => setAddWarehouseSelection("ALL")}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300"
                          />
                          <span className="text-purple-900 font-bold">Both Warehouses</span>
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                            Both ({warehouses.length})
                          </span>
                        </label>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 self-end md:self-center">
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="h-[42px] rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    {addLoading ? "Creating Account..." : "+ Add Staff Account"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Team Members List */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-4 md:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                Team Members ({filteredStaff.length})
              </h2>

              <input
                type="text"
                placeholder="Search staff name, email, warehouse..."
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-full sm:w-64"
              />
            </div>

            {/* Desktop table */}
            {paginatedStaff.length > 0 && (
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Name</th>
                      <th className="px-5 py-3">Email</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Assigned Warehouse</th>
                      <th className="px-5 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStaff.map((member) => (
                      <tr key={member.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-medium text-slate-800">{member.name}</td>
                        <td className="px-5 py-3 text-slate-500">{member.email}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              member.role === "ADMIN"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {member.warehouses && member.warehouses.length > 1 ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex w-fit items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                                Both Warehouses
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {member.warehouses.map((w) => `${w.name} (${w.code})`).join(" & ")}
                              </span>
                            </div>
                          ) : member.warehouse ? (
                            <div>
                              <span className="font-semibold text-slate-800">{member.warehouse.name}</span>
                              <span className="ml-1 text-xs text-slate-400">({member.warehouse.code})</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(member)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              Edit / Change Password
                            </button>
                            {member.role === "STAFF" && (
                              <button
                                type="button"
                                onClick={() => setDeleteId(member.id)}
                                className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile cards */}
            {paginatedStaff.length > 0 && (
              <div className="space-y-3 p-4 md:hidden">
                {paginatedStaff.map((member) => (
                  <div key={member.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{member.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{member.email}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          member.role === "ADMIN" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {member.role}
                      </span>
                    </div>
                    {member.warehouses && member.warehouses.length > 1 ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Warehouse: <b className="text-purple-700">Both Warehouses</b>{" "}
                        <span className="text-slate-400">({member.warehouses.map((w) => w.code).join(", ")})</span>
                      </p>
                    ) : member.warehouse ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Warehouse: <b>{member.warehouse.name}</b> ({member.warehouse.code})
                      </p>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(member)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit / Password
                      </button>
                      {member.role === "STAFF" && (
                        <button
                          type="button"
                          onClick={() => setDeleteId(member.id)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {filteredStaff.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No staff members found.</p>
            )}

            {/* Pagination */}
            {filteredStaff.length > 0 && (
              <Pagination
                currentPage={staffPage}
                totalItems={filteredStaff.length}
                pageSize={staffPageSize}
                onPageChange={(p) => setStaffPage(p)}
                onPageSizeChange={(s) => setStaffPageSize(s)}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            )}
          </div>

          {/* Edit Staff & Password Modal */}
          {editId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-bold text-slate-800">Edit Staff Account</h3>
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleEditStaffSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email Address</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Role</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as "STAFF" | "ADMIN")}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="STAFF">STAFF</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Assigned Warehouse {editRole === "STAFF" ? "*" : "(Optional)"}
                      </label>
                      <span className="text-[11px] text-slate-500">
                        (Choose individual warehouse or &quot;Both Warehouses&quot;)
                      </span>
                    </div>

                    {editRole === "ADMIN" ? (
                      <p className="text-xs text-slate-500 italic p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        Administrators automatically have access to all warehouses.
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {warehouses.map((w) => {
                          const isSelected = editWarehouseSelection === w._id;
                          return (
                            <label
                              key={w._id}
                              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium cursor-pointer transition select-none ${
                                isSelected
                                  ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20 shadow-sm"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="radio"
                                name="editWarehouseSelection"
                                value={w._id}
                                checked={isSelected}
                                onChange={() => setEditWarehouseSelection(w._id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                              />
                              <span className="font-semibold text-slate-800">{w.name}</span>
                              <span className="text-[11px] text-slate-400">({w.code})</span>
                            </label>
                          );
                        })}

                        {warehouses.length >= 2 && (
                          <label
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition select-none ${
                              editWarehouseSelection === "ALL"
                                ? "border-purple-600 bg-purple-50 text-purple-700 ring-2 ring-purple-500/20 shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="radio"
                              name="editWarehouseSelection"
                              value="ALL"
                              checked={editWarehouseSelection === "ALL"}
                              onChange={() => setEditWarehouseSelection("ALL")}
                              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300"
                            />
                            <span className="text-purple-900 font-bold">Both Warehouses</span>
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                              Both ({warehouses.length})
                            </span>
                          </label>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Password Reset Section */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <KeyRound className="h-3.5 w-3.5 text-blue-600" />
                      <span>Change / Reset Password (Optional)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Leave blank to keep the current password. Enter a new password (min. 6 chars) to reset it.
                    </p>
                    <div className="relative">
                      <input
                        type={showEditPassword ? "text" : "password"}
                        placeholder="Enter new password (optional)"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        minLength={6}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 pr-10 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title={showEditPassword ? "Hide password" : "Show password"}
                      >
                        {showEditPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={editLoading}
                      className="flex-1 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {editLoading ? "Saving Changes..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Staff Warehouse Overview */}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">My Warehouse Stock</h1>
            <p className="text-sm text-slate-500">
              {warehouseInfo
                ? `${warehouseInfo.name} (${warehouseInfo.code}) — ${warehouseInfo.address || "Warehouse Hub"}`
                : user?.warehouse
                ? `${user.warehouse.name} (${user.warehouse.code})`
                : "Your warehouse stock overview"}
            </p>
          </div>

          {/* Metric Overview Cards for Staff */}
          {summary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`text-left rounded-xl border p-3.5 shadow-sm transition ${
                  statusFilter === "ALL"
                    ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold text-slate-500">TOTAL UNITS</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Total Stock</p>
                <p className="mt-1 text-xl font-extrabold text-blue-600">{summary.totalUnits}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{summary.distinctProducts} products</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("AVAILABLE")}
                className={`text-left rounded-xl border p-3.5 shadow-sm transition ${
                  statusFilter === "AVAILABLE"
                    ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold text-emerald-600">AVAILABLE</p>
                <p className="mt-1 text-sm font-bold text-slate-800">In Stock</p>
                <p className="mt-1 text-xl font-extrabold text-emerald-600">{summary.availableCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">ready to dispatch</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("LOW_STOCK")}
                className={`text-left rounded-xl border p-3.5 shadow-sm transition ${
                  statusFilter === "LOW_STOCK"
                    ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold text-amber-600">LOW STOCK</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Low (&le;10)</p>
                <p className="mt-1 text-xl font-extrabold text-amber-600">{summary.lowStockCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">need refill</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("OUT_OF_STOCK")}
                className={`text-left rounded-xl border p-3.5 shadow-sm transition ${
                  statusFilter === "OUT_OF_STOCK"
                    ? "border-red-500 bg-red-50/50 ring-2 ring-red-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold text-red-600">EMPTY</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Out of Stock</p>
                <p className="mt-1 text-xl font-extrabold text-red-600">{summary.outOfStockCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">0 quantity</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("ATTENTION")}
                className={`text-left rounded-xl border p-3.5 shadow-sm transition col-span-2 sm:col-span-1 ${
                  statusFilter === "ATTENTION"
                    ? "border-amber-600 bg-amber-50 ring-2 ring-amber-600/30"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> ATTENTION
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">Low & Out</p>
                <p className="mt-1 text-xl font-extrabold text-amber-700">{summary.attentionCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">needs action</p>
              </button>
            </div>
          )}

          {/* Warehouse Stock List for Staff */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 p-4 md:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Warehouse Stock Inventory ({filteredStaffStock.length})
                </h2>
                {statusFilter !== "ALL" && (
                  <p className="text-xs text-blue-600 mt-0.5 font-medium">
                    Filter: {statusFilter.replace("_", " ")}
                    <button
                      type="button"
                      onClick={() => setStatusFilter("ALL")}
                      className="ml-2 text-slate-400 hover:text-slate-700 underline"
                    >
                      Clear filter
                    </button>
                  </p>
                )}
              </div>

              {/* Search in stock */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search product, SKU, rack..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-lg border border-slate-200 pl-8 pr-7 py-1.5 text-xs outline-none focus:border-blue-500 w-full sm:w-56"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div className="p-8 text-center text-sm text-slate-500">Loading warehouse inventory...</div>
            )}

            {/* Desktop table */}
            {!loading && paginatedStaffStock.length > 0 && (
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3">SKU</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Price</th>
                      <th className="px-5 py-3">Rack Location</th>
                      <th className="px-5 py-3">Quantity</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStaffStock.map((item) => {
                      const isLowOrOut = item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK";

                      return (
                        <tr
                          key={item.id}
                          className={`border-t border-slate-100 transition ${
                            isLowOrOut
                              ? item.status === "OUT_OF_STOCK"
                                ? "bg-red-50/30 hover:bg-red-50/60"
                                : "bg-amber-50/30 hover:bg-amber-50/60"
                              : "hover:bg-slate-50/50"
                          }`}
                        >
                          <td className="px-5 py-3 font-medium text-slate-800">
                            {item.productName}
                            {item.sellerName && item.sellerName !== "-" && (
                              <span className="block text-xs text-slate-400 font-normal">
                                Seller: {item.sellerName}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-slate-500">{item.sku}</td>
                          <td className="px-5 py-3">
                            {item.category && item.category !== "-" ? (
                              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                                {item.category}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-800">
                            {item.price != null ? `₹${item.price.toLocaleString("en-IN")}` : "-"}
                          </td>
                          <td className="px-5 py-3 text-slate-600 font-medium">
                            {item.rackName}{" "}
                            <span className="text-xs text-slate-400 font-normal">({item.rackCode})</span>
                          </td>
                          <td className="px-5 py-3 font-bold text-slate-900">
                            <span className={item.quantity === 0 ? "text-red-600" : item.quantity <= 10 ? "text-amber-600" : ""}>
                              {item.quantity}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(item.status)}`}>
                              {item.status.replace("_", " ")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile cards */}
            {!loading && paginatedStaffStock.length > 0 && (
              <div className="space-y-3 p-4 md:hidden">
                {paginatedStaffStock.map((item) => {
                  const isLowOrOut = item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK";

                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-4 transition ${
                        isLowOrOut
                          ? item.status === "OUT_OF_STOCK"
                            ? "border-red-200 bg-red-50/40"
                            : "border-amber-200 bg-amber-50/40"
                          : "border-slate-100 bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">{item.productName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{item.sku}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(item.status)}`}>
                          {item.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                        {item.category && item.category !== "-" && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                            {item.category}
                          </span>
                        )}
                        {item.price != null && (
                          <span className="font-semibold text-slate-800">₹{item.price.toLocaleString("en-IN")}</span>
                        )}
                        <span>
                          Rack: <b>{item.rackName}</b> ({item.rackCode})
                        </span>
                        <span className={`font-bold ${item.quantity === 0 ? "text-red-600" : item.quantity <= 10 ? "text-amber-600" : "text-slate-800"}`}>
                          Qty: {item.quantity}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* No items */}
            {!loading && filteredStaffStock.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                No inventory items found matching your filters.
              </p>
            )}

            {/* Pagination for staff warehouse items */}
            {!loading && filteredStaffStock.length > 0 && (
              <Pagination
                currentPage={stockPage}
                totalItems={filteredStaffStock.length}
                pageSize={stockPageSize}
                onPageChange={(p) => setStockPage(p)}
                onPageSizeChange={(s) => setStockPageSize(s)}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            )}
          </div>
        </>
      )}

      {/* Delete modal for admin */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-red-600">Delete Staff</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete this staff member? This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <WarningPopup
        open={warningOpen}
        message={warningMessage}
        onClose={() => setWarningOpen(false)}
      />
    </div>
  );
}

export default function StaffPage() {
  return (
    <ProtectedPage>
      <Suspense fallback={<div className="min-h-screen bg-slate-50 p-8 text-center text-slate-500">Loading...</div>}>
        <StaffContent />
      </Suspense>
    </ProtectedPage>
  );
}
