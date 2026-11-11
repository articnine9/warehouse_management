export type ConditionQuantities = { good: number; damaged: number; scrap: number };

export const conditionLabels = { good: "Good", damaged: "Damaged", scrap: "Scrap" } as const;

export function conditionTotal(value: ConditionQuantities) {
  return value.good + value.damaged + value.scrap;
}

export function validConditionQuantities(value: unknown, total: number): value is ConditionQuantities {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const counts = value as ConditionQuantities;
  return [counts.good, counts.damaged, counts.scrap].every(n => typeof n === "number" && Number.isSafeInteger(n) && n >= 0)
    && conditionTotal(counts) === total;
}

export function productConditionQuantities(product: {
  conditionQuantities?: ConditionQuantities | null;
  conditionStatus?: string;
}, total: number): ConditionQuantities {
  if (product.conditionQuantities) return { ...product.conditionQuantities };
  return {
    good: !product.conditionStatus || product.conditionStatus === "GOOD_CONDITION" ? total : 0,
    damaged: product.conditionStatus === "DAMAGED" ? total : 0,
    scrap: product.conditionStatus === "SCRAP" ? total : 0,
  };
}
