import { History, Users } from "lucide-react";
import type { ProductHistoryData } from "./ProductHistoryModal";

const date = (value?: string) => value && !Number.isNaN(new Date(value).getTime())
  ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const money = (value?: number) => value == null ? "—" : `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

/** Additional records that are otherwise hidden behind borrower selection or tabs. */
export default function ProductPdfDetails({ data }: { data: ProductHistoryData }) {
  return (
    <div className="product-pdf-view px-8 pb-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {data.employeeHolders.length > 0 && (
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-900"><Users className="h-5 w-5 text-blue-600" />All Employee Custody Details</h2>
            {data.employeeHolders.map((holder, index) => (
              <article key={`${holder.issueId}-${index}`} data-pdf-block className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900">{holder.employeeName}</h3>
                    <p className="text-xs text-slate-500 mt-1">{[holder.employeeCode, holder.employeeDepartment, holder.employeeDesignation].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{holder.holdingStatus.replaceAll("_", " ")}</span>
                </div>
                <dl className="grid grid-cols-3 gap-x-6 gap-y-3 text-xs">
                  {([
                    ["Issue number", holder.issueNumber], ["Issued", date(holder.issueDate)], ["Quantity", holder.quantity],
                    ["Email", holder.employeeEmail], ["Phone", holder.employeePhone], ["Serial number", holder.serialNumber],
                    ["Warehouse", holder.warehouseName], ["Rack / shelf", holder.rackName], ["Site", holder.siteName],
                    ["Return due", date(holder.returnDueDate)], ["Returned", date(holder.returnedAt)], ["Return condition", holder.returnCondition],
                    ["Unit price", money(holder.unitPrice)], ["Total value", money(holder.totalValue)], ["Issued by", holder.issuedByName],
                    ["Last service", date(holder.lastServiceDate)], ["Service count", holder.serviceCount ?? 0], ["Renewals", holder.renewalCount ?? holder.renewalHistory?.length ?? 0],
                    ["Reason", holder.reason], ["Service notes", holder.serviceNotes],
                  ] as const).map(([name, value]) => (
                    <div key={name}>
                      <dt className="font-medium text-slate-500">{name}</dt>
                      <dd className="font-bold text-slate-900 mt-1 break-words whitespace-pre-wrap">{value === undefined || value === "" ? "—" : value}</dd>
                    </div>
                  ))}
                </dl>
                {!!holder.renewalHistory?.length && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2">
                    <h4 className="text-xs font-bold text-blue-900">Return Date Extensions</h4>
                    {holder.renewalHistory.map((renewal, renewalIndex) => (
                      <p key={renewalIndex} className="text-xs text-slate-700">{date(renewal.renewedAt)} · +{renewal.extendedDays} days · Due {date(renewal.newDueDate)}{renewal.notes ? ` · ${renewal.notes}` : ""}{renewal.performedBy ? ` · By ${renewal.performedBy}` : ""}</p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><History className="h-5 w-5 text-blue-600" />Complete Product Lifecycle</h2>
          <div className="space-y-3">
            {[...data.lifecycleEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((event) => (
              <article key={event.id} data-pdf-block className="rounded-xl border border-blue-100 bg-slate-50 p-4 text-xs">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-black text-slate-900">{event.title}</h3>
                    {event.subtitle && <p className="text-slate-600 mt-1">{event.subtitle}</p>}
                  </div>
                  <span className="font-bold text-blue-700">{date(event.date)} · {event.quantity} units</span>
                </div>
                <p className="text-slate-600 mt-2">{[event.entityName, event.location, event.referenceNumber, event.performedByName && `By: ${event.performedByName}`].filter(Boolean).join(" · ")}</p>
                {event.unitPrice != null && <p className="text-slate-700 mt-1">Unit price: {money(event.unitPrice)} · Total value: {money(event.totalValue)}</p>}
                {event.notes && <p className="text-slate-700 mt-2 whitespace-pre-wrap">{event.notes}</p>}
              </article>
            ))}
            {!data.lifecycleEvents.length && <p className="text-sm text-slate-500">No lifecycle records available.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
