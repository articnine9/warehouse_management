"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import ProtectedPage from "@/app/components/ProtectedPage";
import Pagination from "@/app/components/Pagination";
import WarningPopup from "@/app/components/WarningPopup";

type Category = {
  _id: string;
  name: string;
  code: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editLoading, setEditLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function fetchCategories() {
    try {
      setFetching(true);
      const response = await fetch("/api/categories");
      const result = await response.json();
      if (result.success) {
        setCategories(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    void fetchCategories();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          code,
          description,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to add category");
        setWarningOpen(true);
        return;
      }

      setName("");
      setCode("");
      setDescription("");
      await fetchCategories();
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(category: Category) {
    setEditId(category._id);
    setEditName(category.name);
    setEditCode(category.code);
    setEditDescription(category.description || "");
    setEditStatus(category.status);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId) return;
    setEditLoading(true);

    try {
      const response = await fetch(`/api/categories/${editId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editName,
          code: editCode,
          description: editDescription,
          status: editStatus,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to update category");
        setWarningOpen(true);
        return;
      }

      setEditId(null);
      await fetchCategories();
    } catch (error) {
      console.error(error);
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
      const response = await fetch(`/api/categories/${deleteId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to delete category");
        setWarningOpen(true);
        return;
      }

      setDeleteId(null);
      await fetchCategories();
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong");
      setWarningOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase().trim();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCategories.slice(start, start + pageSize);
  }, [filteredCategories, currentPage, pageSize]);

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Product Categories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organize products into categories for easy filtering and tracking ({categories.length} total categories)
          </p>
        </div>

        {/* Add Category Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Add Category</h2>

          <form
            onSubmit={handleSubmit}
            className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 items-end"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Category Name</label>
              <input
                type="text"
                placeholder="e.g. Electronics"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Category Code</label>
              <input
                type="text"
                placeholder="e.g. ELEC"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Description (Optional)</label>
              <input
                type="text"
                placeholder="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-[42px] rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Adding..." : "+ Add Category"}
            </button>
          </form>
        </div>

        {/* Category List */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 md:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Category List ({filteredCategories.length})
            </h2>

            <input
              type="text"
              placeholder="Search category name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-full sm:w-64"
            />
          </div>

          {/* Loading */}
          {fetching && (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
              <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading categories...
            </div>
          )}

          {/* Desktop Table */}
          {!fetching && paginatedCategories.length > 0 && (
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCategories.map((cat) => (
                    <tr key={cat._id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-800">{cat.name}</td>
                      <td className="px-5 py-3 text-slate-600">{cat.code}</td>
                      <td className="px-5 py-3 text-slate-500">{cat.description || "-"}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          cat.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {cat.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(cat)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteId(cat._id)}
                            className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile Cards */}
          {!fetching && paginatedCategories.length > 0 && (
            <div className="space-y-3 p-4 md:hidden">
              {paginatedCategories.map((cat) => (
                <div key={cat._id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{cat.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Code: {cat.code}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      cat.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {cat.status}
                    </span>
                  </div>
                  {cat.description && (
                    <p className="mt-2 text-xs text-slate-600">{cat.description}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openEdit(cat)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(cat._id)}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!fetching && filteredCategories.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">
              No categories found.
            </div>
          )}

          {/* Pagination */}
          {!fetching && filteredCategories.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredCategories.length}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(s) => setPageSize(s)}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          )}
        </div>

        {/* Edit Modal */}
        {editId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-800">Edit Category</h3>
              <form onSubmit={handleEditSubmit} className="mt-5 space-y-3">
                <input
                  type="text"
                  placeholder="Category name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="text"
                  placeholder="Code"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="flex-1 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {editLoading ? "Saving..." : "Save Changes"}
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

        {/* Delete Modal */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-red-600">Delete Category</h3>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to delete this category? Products in this category will not be deleted.
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
      </div>

      <WarningPopup
        open={warningOpen}
        message={warningMessage}
        onClose={() => setWarningOpen(false)}
      />
    </ProtectedPage>
  );
}
