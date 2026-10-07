"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { X, UserCheck, Loader2, Phone, Mail, Building2 } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/app/components/SearchableSelect";
import WarningPopup from "@/app/components/WarningPopup";

type WarehouseItem = {
  _id: string;
  name: string;
  code: string;
};

type AddUserModalProps = {
  isOpen: boolean;
  onClose: () => void;
  warehouses?: WarehouseItem[];
  onSuccess?: (user: any) => void;
  zIndex?: string;
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

const COMMON_DESIGNATIONS = [
  "Operations Lead",
  "Warehouse Supervisor",
  "Senior Technician",
  "Maintenance Specialist",
  "Electrical Technician",
  "Forklift Operator",
  "Inventory Coordinator",
  "Logistics Executive",
  "Safety Inspector",
  "Field Engineer",
];

export default function AddUserModal({
  isOpen,
  onClose,
  warehouses = [],
  onSuccess,
  zIndex = "z-50",
}: AddUserModalProps) {
  const [name, setName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  const [loading, setLoading] = useState(false);
  const [fetchingCode, setFetchingCode] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Fetch next user code when modal opens
  useEffect(() => {
    if (isOpen) {
      void (async () => {
        try {
          setFetchingCode(true);
          const res = await fetch("/api/users/next-code");
          const data = await res.json();
          if (data.success && data.nextCode) {
            setUserCode(data.nextCode);
          }
        } catch (err) {
          console.error("Failed to fetch next user code:", err);
        } finally {
          setFetchingCode(false);
        }
      })();
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!name.trim()) {
      setWarningMessage("User name is required.");
      setWarningOpen(true);
      return;
    }

    if (!department.trim()) {
      setWarningMessage("Department is required.");
      setWarningOpen(true);
      return;
    }

    if (!designation.trim()) {
      setWarningMessage("Designation / Role is required.");
      setWarningOpen(true);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          userCode: userCode.trim().toUpperCase(),
          department: department.trim(),
          designation: designation.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          warehouseId: warehouseId || undefined,
          status,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setWarningMessage(result.message || "Failed to create user.");
        setWarningOpen(true);
        return;
      }

      // Reset form
      setName("");
      setUserCode("");
      setDepartment("");
      setDesignation("");
      setPhone("");
      setEmail("");
      setWarehouseId("");
      setStatus("ACTIVE");

      if (onSuccess && result.data) {
        onSuccess(result.data);
      }
      onClose();
    } catch (error) {
      console.error(error);
      setWarningMessage("Something went wrong while creating user.");
      setWarningOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150`}>
        <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-2xl animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Add New User</h3>
                <p className="text-xs text-slate-500">Register user to assign tools, equipment & assets</p>
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
                  User Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. USR001"
                    value={userCode}
                    onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm uppercase font-mono font-bold text-blue-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  {fetchingCode && (
                    <div className="absolute right-3 top-2.5 text-xs text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  User Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  list="user-department-suggestions"
                  placeholder="e.g. Operations"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <datalist id="user-department-suggestions">
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
                  list="user-designation-suggestions"
                  placeholder="e.g. Senior Technician"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <datalist id="user-designation-suggestions">
                  {COMMON_DESIGNATIONS.map((desig) => (
                    <option key={desig} value={desig} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    placeholder="user@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Warehouse Assignment */}
            {warehouses.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Assigned Warehouse (Optional)
                </label>
                <SearchableSelect
                  options={warehouseOptions}
                  value={warehouseId}
                  onChange={setWarehouseId}
                  placeholder="Select primary warehouse (or General)..."
                />
              </div>
            )}

            {/* Status selector */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200">
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase">User Status</p>
                <p className="text-[11px] text-slate-500">Active users can be issued assets immediately</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("ACTIVE")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    status === "ACTIVE"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("INACTIVE")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    status === "INACTIVE"
                      ? "bg-slate-700 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Inactive
                </button>
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
                {loading ? "Saving..." : "+ Register User"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <WarningPopup
        open={warningOpen}
        onClose={() => setWarningOpen(false)}
        message={warningMessage}
      />
    </>
  );
}
