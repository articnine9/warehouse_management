import { connectDB } from "@/lib/mongodb";
import {
  getUserWarehouse,
  getUserWarehouseId,
  requireSessionUser,
  toSafeUser,
} from "@/lib/auth";
import Inventory from "@/models/Inventory";
import Product from "@/models/Product";
import Rack from "@/models/Rack";
import User from "@/models/User";
import Warehouse from "@/models/Warehouse";

export async function GET() {
  try {
    await connectDB();

    const user = await requireSessionUser();

    if (user.role === "ADMIN") {
      const [
        warehouseCount,
        rackCount,
        productCount,
        inventoryItems,
        lowStockCount,
        staffCount,
      ] = await Promise.all([
        Warehouse.countDocuments(),
        Rack.countDocuments(),
        Product.countDocuments(),
        Inventory.aggregate([
          {
            $group: {
              _id: null,
              totalQuantity: { $sum: "$quantity" },
            },
          },
        ]),
        Inventory.countDocuments({
          status: { $in: ["LOW_STOCK", "OUT_OF_STOCK"] },
        }),
        User.countDocuments({ role: "STAFF" }),
      ]);

      return Response.json({
        success: true,
        role: "ADMIN",
        data: {
          user: toSafeUser(user),
          metrics: [
            { label: "Warehouses", value: warehouseCount },
            { label: "Racks", value: rackCount },
            { label: "Products", value: productCount },
            {
              label: "Total Stock",
              value: inventoryItems[0]?.totalQuantity ?? 0,
            },
            { label: "Staff", value: staffCount },
            { label: "Low / Out", value: lowStockCount },
          ],
        },
      });
    }

    const warehouseId = getUserWarehouseId(user);
    const warehouse = getUserWarehouse(user);

    if (!warehouseId) {
      return Response.json(
        {
          success: false,
          message: "Staff user has no warehouse assignment",
        },
        { status: 400 }
      );
    }

    const [inventoryItems, lowStockItems, distinctProducts] = await Promise.all([
      Inventory.aggregate([
        {
          $match: {
            warehouseId,
          },
        },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: "$quantity" },
          },
        },
      ]),
      Inventory.find({
        warehouseId,
        status: { $in: ["LOW_STOCK", "OUT_OF_STOCK"] },
      })
        .populate("productId", "name sku")
        .populate("rackId", "name code")
        .sort({ quantity: 1 })
        .limit(5),
      Inventory.distinct("productId", { warehouseId }),
    ]);

    return Response.json({
      success: true,
      role: "STAFF",
      data: {
        user: toSafeUser(user),
        metrics: [
          { label: "Assigned Warehouse", value: warehouse?.name || "-" },
          { label: "Products in Warehouse", value: distinctProducts.length },
          { label: "Total Units", value: inventoryItems[0]?.totalQuantity ?? 0 },
          { label: "Attention Needed", value: lowStockItems.length },
        ],
        lowStockItems: lowStockItems.map((item) => ({
          id: item._id.toString(),
          productName:
            typeof item.productId === "object" && item.productId
              ? "name" in item.productId
                ? item.productId.name
                : "Unknown Product"
              : "Unknown Product",
          sku:
            typeof item.productId === "object" && item.productId && "sku" in item.productId
              ? item.productId.sku
              : "-",
          rackName:
            typeof item.rackId === "object" && item.rackId && "name" in item.rackId
              ? item.rackId.name
              : "-",
          rackCode:
            typeof item.rackId === "object" && item.rackId && "code" in item.rackId
              ? item.rackId.code
              : "-",
          quantity: item.quantity,
          status: item.status,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        {
          success: false,
          message: "Not authenticated",
        },
        { status: 401 }
      );
    }

    console.error("GET /api/dashboard error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to fetch dashboard summary",
      },
      { status: 500 }
    );
  }
}
