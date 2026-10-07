"use client";

import { Printer, X } from "lucide-react";

export type IssueBillItem = {
  productId?: string;
  productName: string;
  sku: string;
  serialNumber?: string;
  warehouseName?: string;
  rackName?: string;
  quantity: number;
  unitPrice?: number;
  totalValue?: number;
  productType?: "REUSABLE" | "NON_REUSABLE";
  returnDueDays?: number;
  returnDueDate?: string | Date;
  warrantyMonths?: number;
  serviceIntervalMonths?: number;
  holdingStatus?: string;
};

export type IssueBillData = {
  _id?: string;
  issueNumber: string;
  createdAt: string | Date;
  employeeName: string;
  employeeCode?: string;
  employeeDepartment?: string;
  employeePhone?: string;
  employeeEmail?: string;
  employeeDesignation?: string;
  reason?: string;
  siteName?: string;
  notes?: string;
  issuedByName?: string;
  items: IssueBillItem[];
  totalQuantity?: number;
  totalValue?: number;
};

interface IssueBillModalProps {
  issue: IssueBillData | null;
  onClose: () => void;
}

export default function IssueBillModal({ issue, onClose }: IssueBillModalProps) {
  if (!issue) return null;

  const issueDate = new Date(issue.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const issueTime = new Date(issue.createdAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalUnits =
    issue.totalQuantity ??
    issue.items.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const totalValuation =
    issue.totalValue ??
    issue.items.reduce(
      (sum, item) => sum + (item.totalValue || (item.unitPrice || 0) * (item.quantity || 1)),
      0
    );

  const firstItemWarehouse = issue.items[0]?.warehouseName || "Main Warehouse";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl my-auto rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-3.5 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs shadow-xs">
              W
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm leading-tight">
                Asset Issue Slip & Delivery Voucher
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {issue.issueNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-2xs active:scale-95 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" /> Print Bill
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Bill Paper Content */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto bg-white text-slate-900 print:p-0 print:m-0 print:shadow-none print:max-h-none print:overflow-visible">
          {/* Company & Voucher Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-5 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-black text-sm">
                  W
                </span>
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase">
                  Warehouse Asset Management
                </h1>
              </div>
              <p className="text-xs font-semibold text-slate-600 mt-1">
                Official Equipment Issue Voucher & Custody Delivery Challan
              </p>
              <p className="text-[11px] text-slate-400">
                Authorized Warehouse Logistics & Asset Registry System
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <div className="inline-block bg-slate-900 text-white font-mono text-sm font-bold px-3 py-1 rounded shadow-2xs">
                {issue.issueNumber}
              </div>
              <p className="text-xs text-slate-600 font-semibold mt-1.5">
                Issue Date: <span className="text-slate-900 font-bold">{issueDate}</span>
              </p>
              <p className="text-[11px] text-slate-400">Time: {issueTime}</p>
            </div>
          </div>

          {/* Details Grid: Issued To & Issued From */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Employee Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-500">
                  ISSUED TO (EMPLOYEE / RECIPIENT)
                </span>
                <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
                  Verified
                </span>
              </div>
              <p className="text-sm font-extrabold text-slate-900 pt-0.5">
                {issue.employeeName}
              </p>
              {issue.employeeCode && (
                <p className="text-slate-600">
                  Emp Code: <b className="text-slate-800">{issue.employeeCode}</b>
                </p>
              )}
              <p className="text-slate-600">
                Department: <b className="text-slate-800">{issue.employeeDepartment || "General"}</b>
              </p>
              {issue.employeeDesignation && (
                <p className="text-slate-600">
                  Designation: <b className="text-slate-800">{issue.employeeDesignation}</b>
                </p>
              )}
              {issue.employeePhone && (
                <p className="text-slate-600">Phone: {issue.employeePhone}</p>
              )}
              {issue.employeeEmail && (
                <p className="text-slate-600">Email: {issue.employeeEmail}</p>
              )}
            </div>

            {/* Warehouse & Issuer Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-500">
                  ISSUED FROM (DISPATCH LOCATION)
                </span>
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                  Authorized
                </span>
              </div>
              <p className="text-sm font-extrabold text-slate-900 pt-0.5">
                {firstItemWarehouse}
              </p>
              <p className="text-slate-600">
                Issued By: <b className="text-slate-800">{issue.issuedByName || "System Administrator"}</b>
              </p>
              <p className="text-slate-600">
                Purpose / Reason:{" "}
                <b className="text-slate-800 uppercase">
                  {issue.reason === "MAINTENANCE_AMC"
                    ? "Maintenance / AMC"
                    : (issue.reason || "INSTALLATION_WORK").replaceAll("_", " ")}
                </b>
              </p>
              {issue.siteName && (
                <p className="text-slate-600">
                  Site Name: <b className="text-slate-800">{issue.siteName}</b>
                </p>
              )}
              {issue.notes && (
                <p className="text-slate-500 italic mt-1 bg-white p-1.5 rounded border border-slate-200 text-[11px]">
                  Notes: {issue.notes}
                </p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                  <th className="p-3 text-center w-10 border-r border-slate-200">#</th>
                  <th className="p-3 border-r border-slate-200">Product / Asset Description</th>
                  <th className="p-3 border-r border-slate-200">Rack / Location</th>
                  <th className="p-3 border-r border-slate-200 text-center">Type / Validity</th>
                  <th className="p-3 border-r border-slate-200 text-center w-14">Qty</th>
                  <th className="p-3 border-r border-slate-200 text-right w-24">Rate (₹)</th>
                  <th className="p-3 text-right w-28">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {issue.items.map((item, idx) => {
                  const unitPrice = item.unitPrice || 0;
                  const total = item.totalValue || unitPrice * (item.quantity || 1);
                  const isReusable =
                    item.productType === "REUSABLE" || Boolean(item.returnDueDate);

                  return (
                    <tr key={`${item.sku}-${idx}`} className="hover:bg-slate-50/50">
                      <td className="p-3 text-center text-slate-500 font-bold border-r border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="p-3 border-r border-slate-200">
                        <p className="font-extrabold text-slate-900 text-xs">
                          {item.productName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                          <span>SKU: <b className="text-slate-700">{item.sku}</b></span>
                          {item.serialNumber && (
                            <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 text-slate-800">
                              SN: {item.serialNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-r border-slate-200 text-slate-600">
                        <p className="font-semibold text-slate-800">{item.rackName || "-"}</p>
                        <p className="text-[10px] text-slate-400">{item.warehouseName || "-"}</p>
                      </td>
                      <td className="p-3 border-r border-slate-200 text-center">
                        {isReusable ? (
                          <div>
                            <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">
                              Returnable
                            </span>
                            {item.returnDueDate && (
                              <p className="text-[10px] text-slate-600 font-semibold mt-0.5">
                                Due: {new Date(item.returnDueDate).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                            Standard
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-extrabold text-slate-900 border-r border-slate-200 text-xs">
                        {item.quantity}
                      </td>
                      <td className="p-3 text-right font-medium text-slate-600 border-r border-slate-200">
                        {unitPrice > 0 ? `₹${unitPrice.toLocaleString("en-IN")}` : "-"}
                      </td>
                      <td className="p-3 text-right font-extrabold text-slate-900">
                        {total > 0 ? `₹${total.toLocaleString("en-IN")}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-300 text-xs">
                  <td colSpan={4} className="p-3 text-right text-slate-600 uppercase tracking-wider text-[10px]">
                    Total Issued Units & Valuation:
                  </td>
                  <td className="p-3 text-center font-black text-slate-900 text-sm">
                    {totalUnits}
                  </td>
                  <td className="p-3 border-r border-slate-200"></td>
                  <td className="p-3 text-right font-black text-blue-700 text-sm">
                    {totalValuation > 0 ? `₹${totalValuation.toLocaleString("en-IN")}` : "N/A"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Terms & Agreement Statement */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-[11px] text-slate-500 space-y-1">
            <p className="font-bold text-slate-700">Custody Terms & Return Policy:</p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600">
              <li>The employee acknowledges receipt of the above items in complete and working condition.</li>
              <li>Reusable items must be returned on or before the due date or submitted for renewal.</li>
              <li>Routine maintenance cycles must be followed as notified by the warehouse management system.</li>
              <li>Any loss, damage, or malfunction must be reported immediately to the Warehouse Administrator.</li>
            </ul>
          </div>

          {/* Dual Signatures Block */}
          <div className="pt-6 grid grid-cols-2 gap-8 border-t border-slate-200">
            <div className="space-y-12">
              <div className="h-10 border-b border-dashed border-slate-300" />
              <div>
                <p className="font-bold text-xs text-slate-800">
                  Authorized Warehouse Issuer
                </p>
                <p className="text-[10px] text-slate-400">
                  Sign & Stamp • {firstItemWarehouse}
                </p>
              </div>
            </div>

            <div className="space-y-12 text-right">
              <div className="h-10 border-b border-dashed border-slate-300" />
              <div>
                <p className="font-bold text-xs text-slate-800">
                  Recipient Employee Signature
                </p>
                <p className="text-[10px] text-slate-400">
                  {issue.employeeName} ({issue.employeeDepartment || "Employee"})
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
