export type ProductType = "REUSABLE" | "NON_REUSABLE";

/** Explicit historical classifications take priority over inferred or current types. */
export function resolveProductType(value: unknown, returnDueDate?: unknown, fallback?: unknown): ProductType | undefined {
  if (value === "REUSABLE" || value === "NON_REUSABLE") return value;
  if (returnDueDate) return "REUSABLE";
  if (fallback === "REUSABLE" || fallback === "NON_REUSABLE") return fallback;
  return undefined;
}

export function productTypeLabel(value: unknown): string {
  if (value === "REUSABLE") return "Returnable";
  if (value === "NON_REUSABLE") return "Non-Returnable";
  return "Type not recorded";
}
