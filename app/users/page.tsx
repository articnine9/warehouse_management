"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  UserCheck,
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Building2,
  Phone,
  Mail,
  PackageCheck,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import WarningPopup from "@/app/components/WarningPopup";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import AddUserModal from "@/app/components/AddUserModal";

type Warehouse = {
  _id: string;
  name: string;
  code: string;
};

type UserItem = {
  id: string;
  userCode: string;
  employeeCode?: string;
  name: string;
  phone: string;
  email: string;
  department: string;
  designation: string;
  status: "ACTIVE" | "INACTIVE";
  activeAssetsCount: number;
  warehouse: { id: string; name: string; code: string } | null;
  createdAt?: string;
};

const COMMON_DEPARTMENTS = [
  "Operations",
  "Inventory",
  "Electrical",
  "Maintenance",
  "Logistics",
  "Safety",
  "IT & Systems",
  "Quality Assurance",
  "Administration",
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [fetching, setFetching] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Edit State
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editDesignation, setEditDesignation] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWarehouseId, setEditWarehouseId] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editLoading, setEditLoading] = useState(false);

  // Delete State
  const [deleteUser, setDeleteUser] = useState<UserItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function fetchUsers() {
    try {
      setFetching(true);
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setFetching(false);
    }
  }

  async function fetchWarehouses() {
    try {
      const res = await fetch("/api/warehouses", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setWarehouses(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch warehouses:", err);
    }
  }

  useEffect(() => {
    void fetchUsers();
    void fetchWarehouses();
  }, []);

  // Compute departments list
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) {
      if (u.department) set.add(u.department);
    }
    for (const d of COMMON_DEPARTMENTS) {
      set.add(d);
    }
    return Array.from(set).sort();
  }, [users]);

  // Warehouse options
  const warehouseOptions: SelectOption[] = useMemo(() => {
    return [
      { value: "", label: "General / All Warehouses" },
      ...warehouses.map((w) => ({
        value: w._id,
        label: w.name,
        subLabel: w.code,
      })),
    ];
  }, [warehouses]);

  // Summary Metrics
  const summary = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "ACTIVE").length;
    const inactive = total - active;
    const withAssets = users.filter((u) => (u.activeAssetsCount || 0) > 0).length;
    const totalAssignedAssets = users.reduce((sum, u) => sum + (u.activeAssetsCount || 0), 0);
    return { total, active, inactive, withAssets, totalAssignedAssets };
  }, [users]);

  // Filtering
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
      if (departmentFilter !== "ALL" && u.department !== departmentFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = u.userCode || u.employeeCode || "";
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesCode = code.toLowerCase().includes(q);
        const matchesDept = u.department.toLowerCase().includes(q);
        const matchesDesig = u.designation.toLowerCase().includes(q);
        const matchesPhone = u.phone.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        return matchesName || matchesCode || matchesDept || matchesDesig || matchesPhone || matchesEmail;
      }
      return true;
    });
  }, [users, statusFilter, departmentFilter, searchQuery]);

  // Pagination
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Open Edit Modal
  function openEdit(u: UserItem) {
    setEditUser(u);
    setEditName(u.name);
    setEditCode(u.userCode || u.employeeCode || "");
    setEditDepartment(u.department);
    setEditDesignation(u.designation);
    setEditPhone(u.phone || "");
    setEditEmail(u.email || "");
    setEditWarehouseId(u.warehouse?.id || "");
    setEditStatus(u.status);
  }

  // Handle Edit Submit
  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editUser) return;

    setEditLoading(true);
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          userCode: editCode.trim().toUpperCase(),
          department: editDepartment.trim(),
          designation: editDesignation.trim(),
          phone: editPhone.trim() || undefined,
          email: editEmail.trim() || undefined,
          warehouseId: editWarehouseId || undefined,
          status: editStatus,
        }),
      });

      const result = await res.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to update user");
        setWarningOpen(true);
        return;
      }

      setEditUser(null);
      await fetchUsers();
    } catch (err) {
      console.error(err);
      setWarningMessage("Network error updating user");
      setWarningOpen(true);
    } finally {
      setEditLoading(false);
    }
  }

  // Handle Delete
  async function handleDelete() {
    if (!deleteUser) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/users/${deleteUser.id}`, {
        method: "DELETE",
      });

      const result = await res.json();
      if (!result.success) {
        setWarningMessage(result.message || "Failed to delete user");
        setWarningOpen(true);
        return;
      }

      setDeleteUser(null);
      await fetchUsers();
    } catch (err) {
      console.error(err);
      setWarningMessage("Network error deleting user");
      setWarningOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Users className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
                Users Management
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Manage company users and workforce eligible for tool & equipment issues ({users.length} total)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" /> Add User
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-medium uppercase text-slate-500">Total Users</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total}</p>
            <p className="mt-1 text-[11px] text-slate-500">Registered users & workforce</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-xs">
            <p className="text-xs font-medium uppercase text-emerald-700">Active Users</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{summary.active}</p>
            <p className="mt-1 text-[11px] text-emerald-600">Eligible for asset issues</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-medium uppercase text-slate-500">Inactive Users</p>
            <p className="mt-2 text-2xl font-bold text-slate-700">{summary.inactive}</p>
            <p className="mt-1 text-[11px] text-slate-500">Archived / Offboarded</p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-xs">
            <p className="text-xs font-medium uppercase text-blue-700">Issued Assets In Hand</p>
            <p className="mt-2 text-2xl font-bold text-blue-700">{summary.totalAssignedAssets}</p>
            <p className="mt-1 text-[11px] text-blue-600">Across {summary.withAssets} user(s)</p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Filter Bar */}
          <div className="border-b border-slate-100 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by code, name, department, phone, email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Department Filter */}
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Departments</option>
                {departmentsList.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Loading */}
          {fetching && (
            <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span>Loading users list...</span>
            </div>
          )}

          {/* Empty State */}
          {!fetching && filteredUsers.length === 0 && (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-800">No users found</h3>
              <p className="mt-1 text-xs text-slate-500">
                {searchQuery || statusFilter !== "ALL" || departmentFilter !== "ALL"
                  ? "Try adjusting your filters or search keywords."
                  : "Get started by registering your first user."}
              </p>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                <Plus className="h-4 w-4" /> Add User
              </button>
            </div>
          )}

          {/* Desktop Table */}
          {!fetching && paginatedUsers.length > 0 && (
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">User</th>
                    <th className="px-5 py-3.5">Department & Role</th>
                    <th className="px-5 py-3.5">Contact</th>
                    <th className="px-5 py-3.5">Assigned Warehouse</th>
                    <th className="px-5 py-3.5 text-center">Assets In Hand</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedUsers.map((u) => {
                    const initials = u.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    const code = u.userCode || u.employeeCode || "USR";

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition">
                        {/* User Name & Code */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700 text-xs border border-blue-100">
                              {initials || "US"}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{u.name}</p>
                              <span className="font-mono text-[11px] font-bold text-slate-500">
                                {code}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Department & Role */}
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-slate-800 text-xs">{u.department}</p>
                          <p className="text-[11px] text-slate-500">{u.designation}</p>
                        </td>

                        {/* Contact */}
                        <td className="px-5 py-3.5 text-xs text-slate-600">
                          {u.phone && (
                            <p className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <span>{u.phone}</span>
                            </p>
                          )}
                          {u.email && (
                            <p className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <Mail className="h-3 w-3 text-slate-400" />
                              <span>{u.email}</span>
                            </p>
                          )}
                          {!u.phone && !u.email && <span className="text-slate-400">-</span>}
                        </td>

                        {/* Warehouse */}
                        <td className="px-5 py-3.5 text-xs">
                          {u.warehouse ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium">
                              <Building2 className="h-3 w-3 text-slate-500" />
                              {u.warehouse.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">General</span>
                          )}
                        </td>

                        {/* Active Assets */}
                        <td className="px-5 py-3.5 text-center">
                          {u.activeAssetsCount > 0 ? (
                            <Link
                              href={`/employee-issues/employee/${encodeURIComponent(u.id)}`}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200/80 hover:bg-blue-100 transition"
                              title="Click to view issued assets"
                            >
                              <PackageCheck className="h-3 w-3" />
                              <span>{u.activeAssetsCount} Units</span>
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">0</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              u.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/employee-issues/employee/${encodeURIComponent(u.id)}`}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"
                              title="View User Asset History"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                              title="Edit User"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteUser(u)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                              title="Remove User"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile Card List */}
          {!fetching && paginatedUsers.length > 0 && (
            <div className="block md:hidden divide-y divide-slate-100">
              {paginatedUsers.map((u) => {
                const code = u.userCode || u.employeeCode || "USR";
                return (
                  <div key={u.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{u.name}</p>
                        <span className="font-mono text-xs text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                          {code}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          u.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {u.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block font-semibold">Department</span>
                        <span className="font-medium">{u.department}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block font-semibold">Designation</span>
                        <span className="font-medium">{u.designation}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <div>
                        {u.activeAssetsCount > 0 ? (
                          <Link
                            href={`/employee-issues/employee/${encodeURIComponent(u.id)}`}
                            className="font-bold text-blue-600 underline"
                          >
                            {u.activeAssetsCount} active asset(s)
                          </Link>
                        ) : (
                          <span className="text-slate-400">No assets issued</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/employee-issues/employee/${encodeURIComponent(u.id)}`}
                          className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteUser(u)}
                          className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!fetching && filteredUsers.length > 0 && (
            <div className="border-t border-slate-100 p-4">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredUsers.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>

        {/* ─── ADD USER MODAL ─── */}
        <AddUserModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          warehouses={warehouses}
          onSuccess={() => void fetchUsers()}
        />

        {/* ─── EDIT USER MODAL ─── */}
        {editUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Pencil className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Edit User</h3>
                    <p className="text-xs text-slate-500">Update user details and status</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      User Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm uppercase font-mono font-bold text-blue-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      User Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      list="edit-dept-suggestions"
                      value={editDepartment}
                      onChange={(e) => setEditDepartment(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <datalist id="edit-dept-suggestions">
                      {COMMON_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Designation / Role <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editDesignation}
                      onChange={(e) => setEditDesignation(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {warehouses.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Assigned Warehouse
                    </label>
                    <SearchableSelect
                      options={warehouseOptions}
                      value={editWarehouseId}
                      onChange={setEditWarehouseId}
                      placeholder="Select warehouse..."
                    />
                  </div>
                )}

                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200">
                  <div>
                    <p className="text-xs font-bold text-slate-700 uppercase">User Status</p>
                    <p className="text-[11px] text-slate-500">Set active or inactive</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditStatus("ACTIVE")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        editStatus === "ACTIVE"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditStatus("INACTIVE")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        editStatus === "INACTIVE"
                          ? "bg-slate-700 text-white shadow-xs"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Inactive
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditUser(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-6 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {editLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {editLoading ? "Updating..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── DELETE CONFIRMATION MODAL ─── */}
        {deleteUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-200/80">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Remove User</h3>
                  <p className="text-xs text-slate-500">Confirm removal from user directory</p>
                </div>
              </div>

              <div className="my-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
                <p className="text-sm font-bold text-slate-900">{deleteUser.name}</p>
                <p className="text-xs text-slate-600">
                  Code: <span className="font-mono font-bold text-blue-700">{deleteUser.userCode || deleteUser.employeeCode}</span> | Department: {deleteUser.department}
                </p>
              </div>

              {deleteUser.activeAssetsCount > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Cannot Delete: Active Assets Assigned</span>
                  </div>
                  <p>
                    <strong>{deleteUser.name}</strong> currently holds <strong>{deleteUser.activeAssetsCount} active asset unit(s)</strong>.
                    You must first mark all issued assets as returned in User Asset Management, or change the user&apos;s status to <strong>INACTIVE</strong> instead.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setDeleteLoading(true);
                        try {
                          await fetch(`/api/users/${deleteUser.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "INACTIVE" }),
                          });
                          setDeleteUser(null);
                          await fetchUsers();
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setDeleteLoading(false);
                        }
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition"
                    >
                      {deleteLoading ? "Setting Inactive..." : "Set Status to INACTIVE Instead"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  Are you sure you want to permanently remove this user? This action cannot be undone.
                </p>
              )}

              <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteUser(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                {deleteUser.activeAssetsCount === 0 && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    {deleteLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {deleteLoading ? "Removing..." : "Confirm Removal"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <WarningPopup
          open={warningOpen}
          onClose={() => setWarningOpen(false)}
          message={warningMessage}
        />
      </div>
    </ProtectedPage>
  );
}
