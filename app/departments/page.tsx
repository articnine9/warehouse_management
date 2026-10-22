"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { Plus, Building2, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import WarningPopup from "@/app/components/WarningPopup";
import AddDepartmentModal from "@/app/components/AddDepartmentModal";
import { useAuth } from "@/app/components/AuthProvider";

type Department = {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: string;
};

export default function DepartmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [fetching, setFetching] = useState(true);

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editLoading, setEditLoading] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function fetchDepartments() {
    try {
      setFetching(true);
      const response = await fetch("/api/departments", { cache: "no-store" });
      const result = await response.json();
      if (result.success) {
        setDepartments(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    void fetchDepartments();
  }, []);

  function openEdit(department: Department) {
    setEditId(department._id);
    setEditName(department.name);
    setEditCode(department.code || "");
    setEditDescription(department.description || "");
    setEditStatus(department.status);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId) return;
    setEditLoading(true);

    try {
      const response = await fetch(`/api/departments/${editId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim().toUpperCase() || undefined,
          description: editDescription.trim() || undefined,
          status: editStatus,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to update department");
        setWarningOpen(true);
        return;
      }

      setEditId(null);
      await fetchDepartments();
    } catch (error) {
      console.error("Error updating department:", error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return;
    setDeleteLoading(true);

    try {
      const response = await fetch(`/api/departments/${deleteId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to delete department");
        setWarningOpen(true);
        return;
      }

      setDeleteId(null);
      await fetchDepartments();
    } catch (error) {
      console.error("Error deleting department:", error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        d.name.toLowerCase().includes(q) ||
        (d.code && d.code.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q))
      );
    });
  }, [departments, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredDepartments.length / pageSize) || 1;
  const paginatedDepartments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDepartments.slice(start, start + pageSize);
  }, [filteredDepartments, currentPage, pageSize]);

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-slate-50 p-3 md:p-4 lg:p-5 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Building2 className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Departments</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Manage workforce departments and company divisions ({departments.length} total)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" /> Add Department
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-medium uppercase text-slate-500">Total Departments</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{departments.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-xs">
            <p className="text-xs font-medium uppercase text-emerald-700">Active</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {departments.filter((d) => d.status === "ACTIVE").length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-medium uppercase text-slate-500">Inactive</p>
            <p className="mt-2 text-2xl font-bold text-slate-700">
              {departments.filter((d) => d.status === "INACTIVE").length}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search departments by name or code..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs outline-none focus:border-blue-500 transition"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/70 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">Department Name</th>
                  <th className="px-5 py-3.5">Code</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fetching ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span>Loading departments...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedDepartments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No departments found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedDepartments.map((dept) => (
                    <tr key={dept._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {dept.name}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                          {dept.code || "-"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate">
                        {dept.description || "-"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                            dept.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {dept.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(dept)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="Edit Department"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteId(dept._id);
                                setDeleteName(dept.name);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete Department"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredDepartments.length > 0 && (
            <div className="p-4 border-t border-slate-100">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredDepartments.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>

        {/* Add Modal */}
        <AddDepartmentModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => void fetchDepartments()}
        />

        {/* Edit Modal */}
        {editId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
              <h3 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100">
                Edit Department
              </h3>
              <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Department Code
                  </label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-mono uppercase outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-blue-500 transition resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {editLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {editLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
              <h3 className="text-base font-bold text-slate-800">Delete Department</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Are you sure you want to delete the department{" "}
                <strong className="text-slate-800">&ldquo;{deleteName}&rdquo;</strong>? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition"
                >
                  {deleteLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {deleteLoading ? "Deleting..." : "Delete"}
                </button>
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
