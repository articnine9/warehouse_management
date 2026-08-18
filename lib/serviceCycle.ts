/**
 * Shared helpers for recurring product service cycles.
 * Used by the employee-issues page, the employee-issues API and the dashboard
 * service alerts so that every surface computes the same interval / due dates.
 */

export type DateLike = Date | string | number | null | undefined;

export type ServiceDueState = "NO_SCHEDULE" | "SCHEDULED" | "DUE_SOON" | "OVERDUE";

export type HoldingStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "UNDER_SERVICE"
  | "RETURNED"
  | "DAMAGED";

export const HOLDING_STATUSES: HoldingStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "UNDER_SERVICE",
  "RETURNED",
  "DAMAGED",
];

/** Preset recurring cycles offered in the UI. `0` disables periodic service. */
export const SERVICE_INTERVAL_OPTIONS = [
  { value: "1", label: "Every 1 Month (Monthly)" },
  { value: "3", label: "Every 3 Months (Quarterly - Recommended)" },
  { value: "6", label: "Every 6 Months (Half-Yearly)" },
  { value: "12", label: "Every 12 Months (Yearly)" },
  { value: "0", label: "No Periodic Service" },
] as const;

export const CUSTOM_INTERVAL_VALUE = "custom";
export const MAX_INTERVAL_MONTHS = 120;

/** A service is flagged in notifications this many days before it is due. */
export const DUE_SOON_DAYS = 30;

export function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Adds months without rolling over into the next month (31 Jan + 1m = 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const dayOfMonth = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  return result;
}

export function normalizeIntervalMonths(value: unknown): number {
  const months = Number(value);
  if (!Number.isFinite(months) || months <= 0) return 0;
  return Math.min(MAX_INTERVAL_MONTHS, Math.round(months));
}

export function formatServiceInterval(months?: number | null): string {
  const interval = normalizeIntervalMonths(months);
  if (interval === 0) return "No periodic service";
  if (interval === 1) return "Every 1 month";
  if (interval === 12) return "Every 12 months (yearly)";
  return `Every ${interval} months`;
}

/** Short label used inside dense table cells, e.g. "Every 3m". */
export function formatServiceIntervalShort(months?: number | null): string {
  const interval = normalizeIntervalMonths(months);
  return interval === 0 ? "No schedule" : `Every ${interval}m`;
}

export function formatServiceDate(value: DateLike): string {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function startOfDay(date: Date): Date {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  return result;
}

export type ServiceCycleInput = {
  intervalMonths?: number | null;
  /** Date of the most recently completed service, if any. */
  lastServiceDate?: DateLike;
  /** Fallback anchor when the product was never serviced (usually the issue date). */
  issuedAt?: DateLike;
  /** Overrides `now` in tests. */
  now?: DateLike;
};

export type ServiceCycleInfo = {
  intervalMonths: number;
  intervalLabel: string;
  intervalLabelShort: string;
  /** Anchor date the next due date is calculated from. */
  cycleStartDate: Date | null;
  nextServiceDate: Date | null;
  /** Negative when overdue. */
  daysRemaining: number | null;
  state: ServiceDueState;
  isOverdue: boolean;
  isDueSoon: boolean;
};

export function getServiceCycleInfo(input: ServiceCycleInput): ServiceCycleInfo {
  const intervalMonths = normalizeIntervalMonths(input.intervalMonths);
  const intervalLabel = formatServiceInterval(intervalMonths);
  const intervalLabelShort = formatServiceIntervalShort(intervalMonths);
  const cycleStartDate = toDate(input.lastServiceDate) ?? toDate(input.issuedAt);

  if (intervalMonths === 0 || !cycleStartDate) {
    return {
      intervalMonths,
      intervalLabel,
      intervalLabelShort,
      cycleStartDate,
      nextServiceDate: null,
      daysRemaining: null,
      state: "NO_SCHEDULE",
      isOverdue: false,
      isDueSoon: false,
    };
  }

  const nextServiceDate = addMonths(cycleStartDate, intervalMonths);
  const now = toDate(input.now) ?? new Date();
  const daysRemaining = Math.round(
    (startOfDay(nextServiceDate).getTime() - startOfDay(now).getTime()) / 86_400_000
  );

  const state: ServiceDueState =
    daysRemaining < 0 ? "OVERDUE" : daysRemaining <= DUE_SOON_DAYS ? "DUE_SOON" : "SCHEDULED";

  return {
    intervalMonths,
    intervalLabel,
    intervalLabelShort,
    cycleStartDate,
    nextServiceDate,
    daysRemaining,
    state,
    isOverdue: state === "OVERDUE",
    isDueSoon: state === "DUE_SOON",
  };
}

export function describeDueState(info: ServiceCycleInfo): string {
  if (info.state === "NO_SCHEDULE") return "No schedule";
  if (info.daysRemaining === null) return "No schedule";
  if (info.daysRemaining < 0) return `Overdue by ${Math.abs(info.daysRemaining)} days`;
  if (info.daysRemaining === 0) return "Due today";
  if (info.daysRemaining === 1) return "Due tomorrow";
  return `Due in ${info.daysRemaining} days`;
}
