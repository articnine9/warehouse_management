import { productTypeLabel, resolveProductType } from "@/lib/productType";

export default function ProductTypeBadge({ productType, returnDueDate }: { productType?: unknown; returnDueDate?: unknown }) {
  const type = resolveProductType(productType, returnDueDate);
  const colors = type === "REUSABLE"
    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
    : type === "NON_REUSABLE"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-500";
  return <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 ${colors}`}>{productTypeLabel(type)}</span>;
}
