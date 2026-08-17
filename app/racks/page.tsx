"use client";

import { FormEvent, useEffect, useState } from "react";
import { Tag } from "lucide-react";
import ProtectedPage from "@/app/components/ProtectedPage";

type Warehouse = {
  _id: string;
  name: string;
  code: string;
};

type Rack = {
  _id: string;
  name: string;
  code: string;
  warehouseId: {
    _id: string;
    name: string;
    code: string;
  };
  status: "ACTIVE" | "INACTIVE";
  productCount?: number;
};

export default function RacksPage() {
  const [racks, setRacks] = useState<Rack[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editWarehouseId, setEditWarehouseId] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editLoading, setEditLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function fetchRacks() {
    try {
      const response = await fetch("/api/racks");
      const result = await response.json();
      if (result.success) setRacks(result.data);
    } catch (error) {
      console.error("Failed to fetch racks:", error);
    }
  }

  async function fetchWarehouses() {
    try {
      const response = await fetch("/api/warehouses");
      const result = await response.json();
      if (result.success) setWarehouses(result.data);
    } catch (error) {
      console.error("Failed to fetch warehouses:", error);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRacks();
    void fetchWarehouses();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/racks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code, warehouseId }),
      });
      const result = await response.json();
      if (!result.success) { alert(result.message); return; }
      setName(""); setCode(""); setWarehouseId("");
      await fetchRacks();
    } catch (error) {
      console.error("Failed to create rack:", error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function openEdit(rack: Rack) {
    setEditId(rack._id);
    setEditName(rack.name);
    setEditCode(rack.code);
    setEditWarehouseId(rack.warehouseId._id);
    setEditStatus(rack.status);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId) return;
    setEditLoading(true);
    try {
      const response = await fetch(`/api/racks/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, code: editCode, warehouseId: editWarehouseId, status: editStatus }),
      });
      const result = await response.json();
      if (!result.success) { alert(result.message); return; }
      setEditId(null);
      await fetchRacks();
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/racks/${deleteId}`, { method: "DELETE" });
      const result = await response.json();
      if (!result.success) { alert(result.message); return; }
      setDeleteId(null);
      await fetchRacks();
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Racks</h1>
          <p className="mt-1 text-sm text-slate-500">Manage warehouse racks</p>
        </div>

        {/* Add rack form */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Add Rack</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <input type="text" placeholder="Rack name" value={name} onChange={(e) => setName(e.target.value)} required
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            <input type="text" placeholder="Rack code" value={code} onChange={(e) => setCode(e.target.value)} required
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              <option value="">Select Warehouse</option>
              {warehouses.map((w) => (<option key={w._id} value={w._id}>{w.name} ({w.code})</option>))}
            </select>
            <button type="submit" disabled={loading}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50">
              {loading ? "Adding..." : "Add Rack"}
            </button>
          </form>
        </div>

        {/* Rack list */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4 md:px-6">
            <h2 className="text-lg font-semibold text-slate-800">Rack List</h2>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Rack Name</th>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Warehouse</th>
                  <th className="px-5 py-3">Products</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {racks.map((rack) => (
                  <tr key={rack._id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-800">{rack.name}</td>
                    <td className="px-5 py-3 text-slate-600">{rack.code}</td>
                    <td className="px-5 py-3 text-slate-500">{rack.warehouseId.name} ({rack.warehouseId.code})</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        <Tag className="h-3 w-3" /> {rack.productCount ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${rack.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{rack.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(rack)} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50">Edit</button>
                        <button onClick={() => setDeleteId(rack._id)} className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {racks.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">No racks found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 p-4 md:hidden">
            {racks.map((rack) => (
              <div key={rack._id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{rack.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{rack.code}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${rack.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{rack.status}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Warehouse: {rack.warehouseId.name} ({rack.warehouseId.code})</p>
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                  <Tag className="h-3 w-3" /> Products: {rack.productCount ?? 0}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => openEdit(rack)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">Edit</button>
                  <button onClick={() => setDeleteId(rack._id)} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50">Delete</button>
                </div>
              </div>
            ))}
            {racks.length === 0 && (<p className="py-8 text-center text-sm text-slate-400">No racks found</p>)}
          </div>
        </div>

        {/* Edit modal */}
        {editId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-800">Edit Rack</h3>
              <form onSubmit={handleEditSubmit} className="mt-5 space-y-3">
                <input type="text" placeholder="Rack name" value={editName} onChange={(e) => setEditName(e.target.value)} required
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                <input type="text" placeholder="Rack code" value={editCode} onChange={(e) => setEditCode(e.target.value)} required
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                <select value={editWarehouseId} onChange={(e) => setEditWarehouseId(e.target.value)} required
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Select Warehouse</option>
                  {warehouses.map((w) => (<option key={w._id} value={w._id}>{w.name} ({w.code})</option>))}
                </select>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={editLoading} className="flex-1 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
                    {editLoading ? "Saving..." : "Save Changes"}
                  </button>
                  <button type="button" onClick={() => setEditId(null)} className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete modal */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-red-600">Delete Rack</h3>
              <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete this rack? This action cannot be undone.</p>
              <div className="mt-5 flex gap-3">
                <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
                  {deleteLoading ? "Deleting..." : "Delete"}
                </button>
                <button onClick={() => setDeleteId(null)} className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
