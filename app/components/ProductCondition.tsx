import { conditionLabels, conditionTotal, productConditionQuantities, type ConditionQuantities } from "@/lib/productCondition";

export function ConditionQuantityFields({ value, total, onChange, autoGood = false }: {
  value: ConditionQuantities;
  total: number;
  onChange: (value: ConditionQuantities) => void;
  autoGood?: boolean;
}) {
  const matches = conditionTotal(value) === total;
  return <fieldset className="space-y-2">
    <legend className="text-xs font-bold text-slate-700 uppercase mb-2">Product condition quantities</legend>
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(conditionLabels) as (keyof ConditionQuantities)[]).map(key => <label key={key} className="text-xs font-semibold text-slate-600">
        {conditionLabels[key]}{autoGood && key === "good" ? " (Auto)" : ""}
        <input type="number" min="0" step="1" required readOnly={autoGood && key === "good"} value={value[key]} onChange={event => onChange({ ...value, [key]: Number(event.target.value) })}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
      </label>)}
    </div>
    <p className={`text-xs ${matches ? "text-slate-500" : "text-rose-600"}`} aria-live="polite">
      {autoGood
        ? matches ? `Good = Initial Stock (${total}) − Damaged (${value.damaged}) − Scrap (${value.scrap}).` : "Damaged + Scrap cannot exceed Initial Stock. Enter non-negative whole numbers."
        : `${conditionTotal(value)} / ${total} units classified. Good + Damaged + Scrap must equal stock quantity.`}
    </p>
  </fieldset>;
}

export default function ProductCondition({ product, total }: {
  product: { conditionQuantities?: ConditionQuantities | null; conditionStatus?: string };
  total: number;
}) {
  const value = productConditionQuantities(product, total);
  return <div className="space-y-1.5">
    <p className="text-xs font-bold text-slate-600">Product condition</p>
    <div className="flex flex-wrap gap-2 text-xs font-semibold">
      <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">Good: {value.good}</span>
      <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700">Damaged: {value.damaged}</span>
      <span className="rounded-lg bg-rose-50 px-2 py-1 text-rose-700">Scrap: {value.scrap}</span>
    </div>
    {conditionTotal(value) !== total && <p className="text-xs text-amber-700">Stock has changed since the last condition check ({conditionTotal(value)} units). Update condition quantities in Edit Product.</p>}
  </div>;
}
