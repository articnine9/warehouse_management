import { AlertTriangle, CalendarClock } from "lucide-react";
import {
  describeDueState,
  formatServiceDate,
  getServiceCycleInfo,
  type DateLike,
} from "@/lib/serviceCycle";

type ServiceCycleBadgeProps = {
  intervalMonths?: number | null;
  lastServiceDate?: DateLike;
  issuedAt?: DateLike;
  /** Hides the due-date line, e.g. for items already returned. */
  hideDueDate?: boolean;
  className?: string;
};

/**
 * Compact summary of a recurring service cycle: the configured interval plus the
 * next due date (with an overdue / due-soon accent).
 */
export default function ServiceCycleBadge({
  intervalMonths,
  lastServiceDate,
  issuedAt,
  hideDueDate = false,
  className = "",
}: ServiceCycleBadgeProps) {
  const info = getServiceCycleInfo({ intervalMonths, lastServiceDate, issuedAt });

  const dueToneClass =
    info.state === "OVERDUE"
      ? "text-red-600"
      : info.state === "DUE_SOON"
      ? "text-amber-600"
      : "text-slate-500";

  return (
    <div className={`space-y-0.5 ${className}`}>
      <p className="font-semibold text-slate-700">{info.intervalLabel}</p>

      {!hideDueDate && info.nextServiceDate && (
        <p className={`flex items-center gap-1 text-[11px] font-medium ${dueToneClass}`}>
          {info.isOverdue ? (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          ) : (
            <CalendarClock className="h-3 w-3 shrink-0" />
          )}
          <span>
            Next: {formatServiceDate(info.nextServiceDate)} • {describeDueState(info)}
          </span>
        </p>
      )}

      {!hideDueDate && !info.nextServiceDate && (
        <p className="text-[11px] text-slate-400">No upcoming service</p>
      )}
    </div>
  );
}
