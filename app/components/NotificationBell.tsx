"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, Wrench, AlertTriangle, X, ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";

type ServiceAlert = {
  issueId: string;
  issueNumber: string;
  itemIndex: number;
  employeeName: string;
  employeePhone?: string;
  employeeDepartment?: string;
  productName: string;
  sku: string;
  serialNumber?: string;
  serviceStage: string;
  serviceDate: string;
  holdingStatus: string;
  isOverdue: boolean;
  daysRemaining: number;
};

export default function NotificationBell() {
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<ServiceAlert | null>(null);
  const [serviceNotes, setServiceNotes] = useState("");
  const [markingService, setMarkingService] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchAlerts() {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data?.serviceAlerts) {
        setAlerts(json.data.serviceAlerts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAlerts();

    const timer = setInterval(() => {
      void fetchAlerts();
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkServiceDone() {
    if (!selectedAlert) return;
    setMarkingService(true);
    try {
      const res = await fetch(`/api/employee-issues/${selectedAlert.issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIndex: selectedAlert.itemIndex,
          action: "COMPLETE_SERVICE",
          serviceNotes: serviceNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSelectedAlert(null);
        setServiceNotes("");
        await fetchAlerts();
      } else {
        alert(data.message || "Failed to update service status");
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    } finally {
      setMarkingService(false);
    }
  }

  return (
    <div ref={dropdownRef} className="relative inline-block">
      {/* 🔔 Permanent Bell Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 active:scale-95 shadow-xs"
        title="Notifications & Service Alerts"
      >
        <Bell className={`h-4 w-4 ${alerts.length > 0 ? "text-amber-600" : "text-slate-500"}`} />
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white shadow-xs animate-pulse">
            {alerts.length}
          </span>
        )}
      </button>

      {/* 📋 Responsive Notification Drawer / Modal */}
      {isOpen && (
        <>
          {/* Backdrop for mobile & small screens */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-2xs md:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-x-3 top-14 z-50 mx-auto max-w-sm sm:max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:absolute md:inset-auto md:left-0 md:top-full md:mt-2 md:w-88 md:max-w-none animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-600" />
                <span className="font-bold text-sm text-slate-800">Notifications</span>
                {alerts.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                    {alerts.length} Due
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Link
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5 mr-1"
                >
                  Dashboard <ArrowRight className="h-3 w-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Alerts List */}
            <div className="mt-2.5 max-h-72 space-y-2 overflow-y-auto pr-1 text-xs">
              {alerts.length > 0 ? (
                alerts.map((alert, idx) => (
                  <div
                    key={`${alert.issueId}-${alert.itemIndex}-${idx}`}
                    onClick={() => {
                      setSelectedAlert(alert);
                      setIsOpen(false);
                    }}
                    className={`cursor-pointer rounded-xl p-3 border transition hover:shadow-xs ${alert.isOverdue
                        ? "bg-red-50/70 border-red-200/80 hover:bg-red-50"
                        : "bg-amber-50/70 border-amber-200/80 hover:bg-amber-50"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-bold text-slate-800 text-xs truncate">
                        {alert.productName}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${alert.isOverdue
                            ? "bg-red-600 text-white"
                            : "bg-amber-500 text-white"
                          }`}
                      >
                        {alert.isOverdue ? "OVERDUE" : "DUE SOON"}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 mt-1">
                      Holder: <b>{alert.employeeName}</b> ({alert.employeeDepartment})
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 pt-1.5 border-t border-slate-200/40">
                      <span className="font-semibold text-slate-700">{alert.serviceStage}</span>
                      <span>
                        {alert.isOverdue
                          ? `Overdue by ${Math.abs(alert.daysRemaining)}d`
                          : `${alert.daysRemaining} days left`}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-7 text-center space-y-1">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-slate-700 text-xs">All products up to date!</p>
                  <p className="text-[11px] text-slate-400">No services are overdue or due in the next 30 days.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-2.5 border-t border-slate-100 pt-2 flex justify-between items-center text-[11px]">
              <Link
                href="/employee-issues"
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-blue-600 font-medium"
              >
                View Product History
              </Link>
              <button
                type="button"
                onClick={() => void fetchAlerts()}
                className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
          </div>
        </>
      )}

      {/* 🛠️ Service Completion Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">Service Due Details</h3>
                  <p className="text-xs text-slate-400">Issue #{selectedAlert.issueNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee:</span>
                <span className="font-bold text-slate-800">{selectedAlert.employeeName} ({selectedAlert.employeeDepartment})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Product:</span>
                <span className="font-bold text-slate-800">{selectedAlert.productName}</span>
              </div>
              {selectedAlert.serialNumber !== "-" && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Serial No:</span>
                  <span className="font-semibold text-blue-700">{selectedAlert.serialNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Service Stage:</span>
                <span className="font-bold text-amber-700">{selectedAlert.serviceStage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date:</span>
                <span className="font-bold text-slate-800">
                  {new Date(selectedAlert.serviceDate).toLocaleDateString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-extrabold text-emerald-700">{selectedAlert.holdingStatus}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Service Notes / Remarks (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Enter technician remarks..."
                value={serviceNotes}
                onChange={(e) => setServiceNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={markingService}
                onClick={handleMarkServiceDone}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
              >
                {markingService ? "Saving..." : "✓ Complete Service & Schedule Next Cycle"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
