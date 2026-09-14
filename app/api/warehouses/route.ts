import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Warehouse from "@/models/Warehouse";
import Inventory from "@/models/Inventory";
import Rack from "@/models/Rack";
import StockMovement from "@/models/StockMovement";
import Invoice from "@/models/Invoice";
import EmployeeIssue from "@/models/EmployeeIssue";

export async function GET() {
  try {
    await connectDB();

    const warehouses = await Warehouse.find().sort({
      createdAt: -1,
    });

    const warehouseIds = warehouses.map((w) => w._id);

    const [productCounts, rackCounts] = await Promise.all([
      Inventory.aggregate([
        { $match: { warehouseId: { $in: warehouseIds } } },
        { $group: { _id: "$warehouseId", productCount: { $sum: 1 }, totalUnits: { $sum: "$quantity" } } },
      ]),
      Rack.aggregate([
        { $match: { warehouseId: { $in: warehouseIds } } },
        { $group: { _id: "$warehouseId", rackCount: { $sum: 1 } } },
      ]),
    ]);

    const countMap = new Map(
      productCounts.map((item) => [
        item._id.toString(),
        { productCount: item.productCount, totalUnits: item.totalUnits },
      ])
    );
    const rackCountMap = new Map(
      rackCounts.map((item) => [item._id.toString(), item.rackCount])
    );

    const data = warehouses.map((w) => {
      const invStats = countMap.get(w._id.toString());
      return {
        ...w.toObject(),
        productCount: invStats?.productCount || 0,
        totalUnits: invStats?.totalUnits || 0,
        rackCount: rackCountMap.get(w._id.toString()) || 0,
      };
    });

    // Auto-sync warehouse names in background for any renamed warehouse
    for (const w of warehouses) {
      void StockMovement.updateMany(
        { warehouseId: w._id, warehouseName: { $ne: w.name } },
        { $set: { warehouseName: w.name } }
      ).exec();
      void Invoice.updateMany(
        { "items.warehouseId": w._id, "items.warehouseName": { $ne: w.name } },
        { $set: { "items.$[elem].warehouseName": w.name } },
        { arrayFilters: [{ "elem.warehouseId": w._id, "elem.warehouseName": { $ne: w.name } }] }
      ).exec();
      void EmployeeIssue.updateMany(
        { "items.warehouseId": w._id, "items.warehouseName": { $ne: w.name } },
        { $set: { "items.$[elem].warehouseName": w.name } },
        { arrayFilters: [{ "elem.warehouseId": w._id, "elem.warehouseName": { $ne: w.name } }] }
      ).exec();
    }

    return Response.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error("GET warehouses error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to fetch warehouses",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        {
          success: false,
          message: "Only admin can add warehouses",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const warehouse = await Warehouse.create({
      name: body.name,
      code: body.code,
      address: body.address,
      status: body.status ?? "ACTIVE",
    });

    return Response.json(
      {
        success: true,
        data: warehouse,
      },
      { status: 201 }
    );
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

    console.error("POST warehouse error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to create warehouse",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
