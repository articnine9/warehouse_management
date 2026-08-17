import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Inventory from "@/models/Inventory";
import Product from "@/models/Product";
import Warehouse from "@/models/Warehouse";
import Rack from "@/models/Rack";

type InventorySearchFilter = {
  warehouseId?: string | mongoose.Types.ObjectId;
  rackId?: string | mongoose.Types.ObjectId;
  status?: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK" | string;
  productId?: { $in: mongoose.Types.ObjectId[] };
};

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    void Product;
    void Warehouse;
    void Rack;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || searchParams.get("q") || "";
    const warehouseId = searchParams.get("warehouseId");
    const rackId = searchParams.get("rackId");
    const status = searchParams.get("status");

    const filter: InventorySearchFilter = {};

    if (warehouseId) {
      filter.warehouseId = warehouseId;
    }

    if (rackId) {
      filter.rackId = rackId;
    }

    if (status) {
      filter.status = status;
    }

    if (query.trim()) {
      const matchingProducts = await Product.find({
        $or: [
          { name: { $regex: query.trim(), $options: "i" } },
          { sku: { $regex: query.trim(), $options: "i" } },
        ],
      }).select("_id");

      filter.productId = {
        $in: matchingProducts.map((product) => product._id as mongoose.Types.ObjectId),
      };
    }

    const inventory = await Inventory.find(filter as any)
      .populate("productId", "name sku category price sellerName")
      .populate("warehouseId", "name code")
      .populate("rackId", "name code")
      .sort({ createdAt: -1 });

    return Response.json({
      success: true,
      data: inventory,
      count: inventory.length,
    });
  } catch (error) {
    console.error("GET inventory search error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to search inventory",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
