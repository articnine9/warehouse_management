import { resolveProductType, type ProductType } from "./productType";

type Issue = {
  _id: unknown;
  issueNumber: string;
  items: { productId?: unknown; sku?: string; serialNumber?: string; productType?: unknown; returnDueDate?: unknown }[];
};
type Movement = {
  productId?: unknown;
  sku?: string;
  serialNumber?: string;
  productType?: unknown;
  referenceId?: string;
  referenceNumber?: string;
  reason?: string;
};

export function movementProductType(movement: Movement, issues: Issue[] = [], catalogType?: unknown): ProductType | undefined {
  const recorded = resolveProductType(movement.productType);
  if (recorded) return recorded;
  if (movement.reason === "EMPLOYEE_ISSUE" || movement.reason === "EMPLOYEE_RETURN") {
    const productId = movement.productId && typeof movement.productId === "object" && "_id" in movement.productId ? movement.productId._id : movement.productId;
    const issueNumber = movement.referenceNumber?.replace(/^(?:ISSUE|RETURN)\s*#\s*/i, "");
    const issue = issues.find((item) => String(item._id) === movement.referenceId || item.issueNumber === issueNumber);
    const matches = issue?.items.filter((item) =>
      ((movement.sku && item.sku === movement.sku) || (productId && item.productId && String(item.productId) === String(productId))) &&
      (!movement.serialNumber || item.serialNumber === movement.serialNumber)
    ) || [];
    const types = new Set(matches.map((item) => resolveProductType(item.productType, item.returnDueDate)));
    // Mixed or missing historical classifications cannot be inferred from today's catalog.
    return types.size === 1 ? types.values().next().value : undefined;
  }
  return resolveProductType(catalogType);
}
