import type { PipelineStage } from "mongoose";

export function productStockStatus(quantity: number) {
  return quantity <= 0 ? "OUT_OF_STOCK" : quantity <= 10 ? "LOW_STOCK" : "AVAILABLE";
}

/** Summarize existing catalog products, counting each product once across racks. */
export function productStockSummaryPipeline(warehouseIds?: unknown[]): PipelineStage[] {
  return [
    ...(warehouseIds ? [{ $match: { warehouseId: { $in: warehouseIds } } }] : []),
    { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "catalogProduct" } },
    { $match: { "catalogProduct.0": { $exists: true } } },
    { $group: { _id: "$productId", quantity: { $sum: "$quantity" } } },
    { $group: {
      _id: null,
      totalQuantity: { $sum: "$quantity" },
      distinctProducts: { $sum: 1 },
      lowStockCount: { $sum: { $cond: [{ $and: [{ $gt: ["$quantity", 0] }, { $lte: ["$quantity", 10] }] }, 1, 0] } },
      outOfStockCount: { $sum: { $cond: [{ $lte: ["$quantity", 0] }, 1, 0] } },
    } },
  ];
}
