export type ConditionQuantities = { new: number; used: number; damaged: number; scrap: number };
export type SavedConditionQuantities = ConditionQuantities | { good: number; damaged: number; scrap: number };

export const conditionLabels = { new: "New", used: "Used", damaged: "Damaged", scrap: "Scrap" } as const;

export function conditionTotal(value: ConditionQuantities) {
  return value.new + value.used + value.damaged + value.scrap;
}

export function validConditionQuantities(value: unknown, total: number): value is ConditionQuantities {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const counts = value as ConditionQuantities;
  return [counts.new, counts.used, counts.damaged, counts.scrap].every(n => typeof n === "number" && Number.isSafeInteger(n) && n >= 0)
    && conditionTotal(counts) === total;
}

export function productConditionQuantities(product: {
  conditionQuantities?: SavedConditionQuantities | null;
  conditionStatus?: string;
}, total: number): ConditionQuantities {
  if (product.conditionQuantities) {
    const counts = product.conditionQuantities;
    if ("new" in counts) {
      return { new: counts.new, used: counts.used, damaged: counts.damaged, scrap: counts.scrap };
    }
    return { new: 0, used: counts.good, damaged: counts.damaged, scrap: counts.scrap };
  }
  return {
    new: product.conditionStatus === "NEW" ? total : 0,
    used: !product.conditionStatus || product.conditionStatus === "GOOD_CONDITION" || product.conditionStatus === "USED" ? total : 0,
    damaged: product.conditionStatus === "DAMAGED" ? total : 0,
    scrap: product.conditionStatus === "SCRAP" ? total : 0,
  };
}
