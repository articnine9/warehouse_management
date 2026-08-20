"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  History,
  RotateCcw,
  Wrench,
  X,
} from "lucide-react";
import {
  CUSTOM_INTERVAL_VALUE,
  HOLDING_STATUSES,
  MAX_INTERVAL_MONTHS,
  SERVICE_INTERVAL_OPTIONS,
  describeDueState,
  formatServiceDate,
  formatServiceInterval,
  getServiceCycleInfo,
  normalizeIntervalMonths,
  type HoldingStatus,
} from "@/lib/serviceCycle";
import { holdingStatusLabels, type EmployeeIssue } from "./types";

type ServiceCycleModalProps = {
  issue: EmployeeIssue;
  itemIndex: number;
  onClose: () => void;
  onUpdated: (updatedIssue: EmployeeIssue) => void;
};

const presetValues = SERVICE_INTERVAL_OPTIONS.map((option) => option.value) as string[];

export default function ServiceCycleModal({
  issue,
  itemIndex,
  onClose,
  onUpdated,
}: ServiceCycleModalProps) {
  const item = issue.items[itemIndex];

  const initialInterval = normalizeIntervalMonths(item?.serviceIntervalMonths);
  const isPreset = presetValues.includes(String(initialInterval));

  const [holdingStatus, setHoldingStatus] = useState<HoldingStatus>(
    (item?.holdingStatus || "ACTIVE") as HoldingStatus
  );
  const [intervalPreset, setIntervalPreset] = useState(
    isPreset ? String(initialInterval) : CUSTOM_INTERVAL_VALUE
  );
  const [customInterval, setCustomInterval] = useState(
    isPreset ? "" : String(initialInterval)
  );
  const [markServiceCompleted, setMarkServiceCompleted] = useState(false);
  const [serviceNotes, setServiceNotes] = useState(item?.serviceNotes || "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedIntervalMonths =
    intervalPreset === CUSTOM_INTERVAL_VALUE
      ? normalizeIntervalMonths(customInterval)
      : normalizeIntervalMonths(intervalPreset);

  const isReturned = (item?.holdingStatus || "ACTIVE") === "RETURNED";
  const completedCount = Math.max(item?.serviceHistory?.length || 0, item?.serviceCount || 0);
  const nextServiceNumber = completedCount + 1;

  const currentCycle = useMemo(
    () =>
      getServiceCycleInfo({
        intervalMonths: item?.serviceIntervalMonths,
        lastServiceDate: item?.lastServiceDate,
        issuedAt: issue.createdAt,
      }),
    [item?.serviceIntervalMonths, item?.lastServiceDate, issue.createdAt]
  );

  /** Preview of the cycle after saving the currently selected values. */
  const previewCycle = useMemo(
    () =>
      getServiceCycleInfo({
        intervalMonths: selectedIntervalMonths,
        lastServiceDate: markServiceCompleted ? new Date() : item?.lastServiceDate,
        issuedAt: issue.createdAt,
      }),
    [selectedIntervalMonths, markServiceCompleted, item?.lastServiceDate, issue.createdAt]
  );

  const isReusable = item?.productType === "REUSABLE" || Boolean(item?.returnDueDate);
  const [renewDays, setRenewDays] = useState("30");
  const [renewing, setRenewing] = useState(false);

  let returnDaysLeft: number | null = null;
  if (isReusable && item?.returnDueDate) {
    const dueTime = new Date(item.returnDueDate).setHours(0, 0, 0, 0);
    const nowTime = new Date().setHours(0, 0, 0, 0);
    returnDaysLeft = Math.round((dueTime - nowTime) / 86400000);
  }

  async function handleRenewItem() {
    setRenewing(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/employee-issues/${issue._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIndex,
          action: "RENEW_ITEM",
          extendedDays: Math.max(1, Number(renewDays) || 30),
          serviceNotes: serviceNotes.trim() || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        setErrorMessage(result.message || "Failed to renew item");
        return;
      }

      onUpdated(result.data as EmployeeIssue);
      onClose();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to renew item period");
    } finally {
      setRenewing(false);
    }
  }

  if (!item) return null;

  async function handleSave() {
    if (intervalPreset === CUSTOM_INTERVAL_VALUE && selectedIntervalMonths <= 0) {
      setErrorMessage(`Enter custom months between 1 and ${MAX_INTERVAL_MONTHS}`);
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/employee-issues/${issue._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIndex,
          holdingStatus,
          serviceIntervalMonths: selectedIntervalMonths,
          markServiceCompleted,
          serviceNotes: serviceNotes.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setErrorMessage(result.message || "Failed to update this item");
        return;
      }

      onUpdated(result.data as EmployeeIssue);
      onClose();
    } catch (error) {
      console.error("Failed to update employee issue item:", error);
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage asset and service cycle"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-bold text-slate-800">Manage Asset & Service Cycle</h3>
              <p className="text-xs text-slate-400">
                {item.productName} • Issue #{issue.issueNumber}
                {item.serialNumber ? ` • SN: ${item.serialNumber}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Reusable Asset Return Validity & Renewal */}
        {isReusable && item.returnDueDate && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-indigo-900 flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5 text-indigo-600" /> Reusable Return / Renewal Status
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  isReturned
                    ? "bg-slate-200 text-slate-700"
                    : returnDaysLeft !== null && returnDaysLeft < 0
                    ? "bg-red-600 text-white"
                    : returnDaysLeft !== null && returnDaysLeft <= 7
                    ? "bg-amber-500 text-white"
                    : "bg-indigo-600 text-white"
                }`}
              >
                {isReturned
                  ? "RETURNED TO STOCK"
                  : returnDaysLeft !== null && returnDaysLeft < 0
                  ? `OVERDUE BY ${Math.abs(returnDaysLeft)} DAYS`
                  : returnDaysLeft === 0
                  ? "DUE TODAY"
                  : `${returnDaysLeft} DAYS REMAINING`}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
              <dt className="text-slate-500">Return due date</dt>
              <dd className="font-bold text-slate-800 text-right">
                {new Date(item.returnDueDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </dd>

              <dt className="text-slate-500">Renewals performed</dt>
              <dd className="font-semibold text-slate-800 text-right">
                {item.renewalCount || 0} times
              </dd>
            </dl>

            {!isReturned && (
              <div className="pt-2 border-t border-indigo-200/60 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-950">Extend Validity:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    value={renewDays}
                    onChange={(e) => setRenewDays(e.target.value)}
                    className="w-16 rounded border border-indigo-300 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none"
                  />
                  <span className="text-[11px] text-indigo-900">Days</span>
                </div>

                <div className="flex gap-1">
                  {[7, 15, 30, 60, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setRenewDays(d.toString())}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${
                        renewDays === d.toString()
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                      }`}
                    >
                      +{d}d
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={renewing}
                  onClick={handleRenewItem}
                  className="ml-auto rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                >
                  {renewing ? "Renewing..." : "✓ Renew Period"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Current service cycle summary */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-blue-600" />
            Current Service Cycle
          </p>
          <dl className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
            <dt className="text-slate-500">Service interval</dt>
            <dd className="font-semibold text-slate-800 text-right">
              {formatServiceInterval(item.serviceIntervalMonths)}
            </dd>

            <dt className="text-slate-500">Services completed</dt>
            <dd className="font-semibold text-slate-800 text-right">{completedCount} times</dd>

            <dt className="text-slate-500">Last serviced</dt>
            <dd className="font-semibold text-slate-800 text-right">
              {item.lastServiceDate ? formatServiceDate(item.lastServiceDate) : "Never serviced"}
            </dd>

            <dt className="text-slate-500">Next service due</dt>
            <dd
              className={`font-semibold text-right ${
                currentCycle.isOverdue
                  ? "text-red-600"
                  : currentCycle.isDueSoon
                  ? "text-amber-600"
                  : "text-slate-800"
              }`}
            >
              {currentCycle.nextServiceDate
                ? `${formatServiceDate(currentCycle.nextServiceDate)} (${describeDueState(currentCycle)})`
                : "Not scheduled"}
            </dd>
          </dl>
        </div>

        {/* Update form */}
        <div className="space-y-3">
          <div>
            <label
              htmlFor="holding-status"
              className="block text-[11px] font-semibold text-slate-600 uppercase mb-1"
            >
              Current Product Holding Status
            </label>
            <select
              id="holding-status"
              value={holdingStatus}
              disabled={isReturned}
              onChange={(event) => setHoldingStatus(event.target.value as HoldingStatus)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
            >
              {HOLDING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {holdingStatusLabels[status]}
                </option>
              ))}
            </select>
            {isReturned && (
              <p className="mt-1 text-[11px] text-slate-400">
                Stock is already back in the warehouse, so the status is locked.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="service-interval"
                className="block text-[11px] font-semibold text-slate-600 uppercase mb-1"
              >
                Service Interval (Recurring Months)
              </label>
              <select
                id="service-interval"
                value={intervalPreset}
                onChange={(event) => setIntervalPreset(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {SERVICE_INTERVAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value={CUSTOM_INTERVAL_VALUE}>Custom Months...</option>
              </select>
            </div>

            {intervalPreset === CUSTOM_INTERVAL_VALUE && (
              <div>
                <label
                  htmlFor="custom-interval"
                  className="block text-[11px] font-semibold text-slate-600 uppercase mb-1"
                >
                  Enter Custom Months
                </label>
                <input
                  id="custom-interval"
                  type="number"
                  min="1"
                  max={MAX_INTERVAL_MONTHS}
                  placeholder="e.g. 2, 4, 9..."
                  value={customInterval}
                  onChange={(event) => setCustomInterval(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}
          </div>

          {/* Mark service completed checkbox */}
          <label
            htmlFor="mark-service-completed"
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
              markServiceCompleted
                ? "border-emerald-300 bg-emerald-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <input
              id="mark-service-completed"
              type="checkbox"
              checked={markServiceCompleted}
              onChange={(event) => setMarkServiceCompleted(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 accent-emerald-600 focus:ring-2 focus:ring-emerald-500/30"
            />
            <span className="space-y-0.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <CheckCircle2
                  className={`h-4 w-4 ${markServiceCompleted ? "text-emerald-600" : "text-slate-400"}`}
                />
                Mark service completed
              </span>
              <span className="block text-[11px] text-slate-500">
                Records service <b>#{nextServiceNumber}</b> today and restarts the{" "}
                {formatServiceInterval(selectedIntervalMonths).toLowerCase()} cycle.
              </span>
            </span>
          </label>

          <div>
            <label
              htmlFor="service-notes"
              className="block text-[11px] font-semibold text-slate-600 uppercase mb-1"
            >
              Service Remarks (Optional)
            </label>
            <textarea
              id="service-notes"
              rows={2}
              placeholder="e.g. serviced by technician, parts replaced..."
              value={serviceNotes}
              onChange={(event) => setServiceNotes(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Preview of the resulting cycle */}
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] font-medium text-blue-800">
            After saving:{" "}
            <b>
              {previewCycle.nextServiceDate
                ? `next service due ${formatServiceDate(previewCycle.nextServiceDate)}`
                : "no periodic service scheduled"}
            </b>
            {markServiceCompleted ? ` • total services ${nextServiceNumber}` : ""}
          </p>

          {/* Past service records */}
          {(item.serviceHistory?.length || 0) > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <History className="h-3.5 w-3.5 text-blue-600" /> Past Service Records
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto text-xs">
                {item.serviceHistory?.map((record, index) => (
                  <div
                    key={`${record.serviceNumber}-${index}`}
                    className="rounded border border-slate-200/60 bg-white p-2"
                  >
                    <div className="flex justify-between font-semibold text-slate-800">
                      <span>Service #{record.serviceNumber}</span>
                      <span className="text-[11px] text-slate-500">
                        {formatServiceDate(record.completedAt)}
                      </span>
                    </div>
                    {record.notes && (
                      <p className="mt-0.5 text-[11px] text-slate-600">{record.notes}</p>
                    )}
                    {record.performedBy && (
                      <p className="text-[10px] text-slate-400">By {record.performedBy}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {errorMessage && (
            <p
              role="alert"
              className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700"
            >
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {errorMessage}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex-1 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
