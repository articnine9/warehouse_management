import { connectDB } from "@/lib/mongodb";
import { getUserWarehouseId, getUserWarehouse, requireSessionUser, toSafeUser } from "@/lib/auth";
import Inventory from "@/models/Inventory";
import User from "@/models/User";
import Product from "@/models/Product";
import Rack from "@/models/Rack";
import Warehouse from "@/models/Warehouse";
import Category from "@/models/Category";

export async function GET() {
  try {
    await connectDB();

    const currentUser = await requireSessionUser();

    if (currentUser.role === "ADMIN") {
      const staff = await User.find({ role: "STAFF" })
        .select("-passwordHash")
        .populate("warehouseId", "name code address")
        .sort({ createdAt: -1 });

      return Response.json({
        success: true,
        role: "ADMIN",
        data: staff.map((member) => toSafeUser(member)),
      });
    }

    // For STAFF users - get their assigned warehouse inventory with full details
    const warehouseId = getUserWarehouseId(currentUser);
    const userWarehouse = getUserWarehouse(currentUser);

    if (!warehouseId) {
      return Response.json(
        {
          success: false,
          role: "STAFF",
          message: "Staff user has no warehouse assignment",
          data: {
            user: toSafeUser(currentUser),
            warehouse: null,
            items: [],
            summary: {
              totalUnits: 0,
              distinctProducts: 0,
              availableCount: 0,
              lowStockCount: 0,
              outOfStockCount: 0,
              attentionCount: 0,
            },
          },
        },
        { status: 200 }
      );
    }

    // Ensure models are registered for Mongoose populate
    void Product;
    void Rack;
    void Warehouse;
    void Category;

    // Fetch ALL inventory records for this warehouse
    const inventory = await Inventory.find({ warehouseId })
      .populate("productId", "name sku category price sellerName description")
      .populate("rackId", "name code")
      .populate("warehouseId", "name code address")
      .sort({ quantity: 1 });

    const totalUnits = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const availableCount = inventory.filter((item) => item.status === "AVAILABLE").length;
    const lowStockCount = inventory.filter((item) => item.status === "LOW_STOCK").length;
    const outOfStockCount = inventory.filter((item) => item.status === "OUT_OF_STOCK").length;
    const attentionCount = lowStockCount + outOfStockCount;
    const distinctProductIds = new Set(
      inventory.map((item) =>
        typeof item.productId === "object" && item.productId ? item.productId._id?.toString() : ""
      ).filter(Boolean)
    );

    const formattedItems = inventory.map((item) => {
      const prod = typeof item.productId === "object" && item.productId ? item.productId : null;
      const rack = typeof item.rackId === "object" && item.rackId ? item.rackId : null;
      const wh = typeof item.warehouseId === "object" && item.warehouseId ? item.warehouseId : null;

      return {
        id: item._id.toString(),
        productName: prod && "name" in prod ? prod.name : "Unknown Product",
        sku: prod && "sku" in prod ? prod.sku : "-",
        category: prod && "category" in prod ? prod.category : "-",
        price: prod && "price" in prod ? prod.price : null,
        sellerName: prod && "sellerName" in prod ? prod.sellerName : "-",
        rackName: rack && "name" in rack ? rack.name : "-",
        rackCode: rack && "code" in rack ? rack.code : "-",
        quantity: item.quantity,
        status: item.status,
        warehouseName: wh && "name" in wh ? wh.name : "-",
        warehouseCode: wh && "code" in wh ? wh.code : "-",
      };
    });

    return Response.json({
      success: true,
      role: "STAFF",
      data: {
        user: toSafeUser(currentUser),
        warehouse: userWarehouse,
        summary: {
          totalUnits,
          distinctProducts: distinctProductIds.size,
          availableCount,
          lowStockCount,
          outOfStockCount,
          attentionCount,
        },
        items: formattedItems,
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

    console.error("GET /api/staff error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to fetch staff details",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
