import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Warehouse from "@/models/Warehouse";
import Rack from "@/models/Rack";
import Inventory from "@/models/Inventory";
import Product from "@/models/Product";
import Employee from "@/models/Employee";
import StockMovement from "@/models/StockMovement";
import Invoice from "@/models/Invoice";
import EmployeeIssue from "@/models/EmployeeIssue";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    await requireSessionUser();

    // Ensure models are registered for populate
    void Product;
    void Rack;

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
      return Response.json(
        { success: false, message: "Warehouse not found" },
        { status: 404 }
      );
    }

    // 1. Get all racks in this warehouse
    const racks = await Rack.find({ warehouseId: id }).sort({ name: 1 });
    const rackIds = racks.map((r) => r._id);

    // Product counts & units per rack
    const rackStats = await Inventory.aggregate([
      { $match: { rackId: { $in: rackIds } } },
      {
        $group: {
          _id: "$rackId",
          productCount: { $sum: 1 },
          totalUnits: { $sum: "$quantity" },
        },
      },
    ]);
    const rackStatsMap = new Map(
      rackStats.map((item) => [
        item._id.toString(),
        { productCount: item.productCount, totalUnits: item.totalUnits },
      ])
    );

    const populatedRacks = racks.map((r) => ({
      ...r.toObject(),
      productCount: rackStatsMap.get(r._id.toString())?.productCount || 0,
      totalUnits: rackStatsMap.get(r._id.toString())?.totalUnits || 0,
    }));

    // 2. Get all inventory items in this warehouse
    const inventory = await Inventory.find({ warehouseId: id })
      .populate("productId", "name sku price category productType unit")
      .populate("rackId", "name code")
      .sort({ updatedAt: -1 });

    // 3. Get employees assigned to this warehouse
    const employees = await Employee.find({ warehouseId: id, status: "ACTIVE" })
      .select("name employeeCode department designation phone email");

    // 4. Calculate summary KPIs
    const totalUnits = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const lowStockCount = inventory.filter((item) => item.status === "LOW_STOCK").length;
    const outOfStockCount = inventory.filter((item) => item.status === "OUT_OF_STOCK").length;

    return Response.json({
      success: true,
      data: {
        warehouse,
        racks: populatedRacks,
        inventory,
        employees,
        summary: {
          totalRacks: racks.length,
          totalProducts: inventory.length,
          totalUnits,
          lowStockCount,
          outOfStockCount,
          totalEmployees: employees.length,
        },
      },
    });
  } catch (error) {
    console.error("GET warehouse [id] error:", error);
    return Response.json(
      { success: false, message: "Failed to fetch warehouse details" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only admin can update warehouses" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const oldWarehouse = await Warehouse.findById(id);
    if (!oldWarehouse) {
      return Response.json(
        { success: false, message: "Warehouse not found" },
        { status: 404 }
      );
    }

    const oldName = oldWarehouse.name;
    const newName = body.name ? String(body.name).trim() : oldName;

    const warehouse = await Warehouse.findByIdAndUpdate(
      id,
      {
        name: newName,
        code: body.code ? String(body.code).trim() : oldWarehouse.code,
        address: body.address !== undefined ? String(body.address).trim() : oldWarehouse.address,
        status: body.status || oldWarehouse.status,
      },
      { new: true }
    );

    if (!warehouse) {
      return Response.json(
        { success: false, message: "Warehouse not found" },
        { status: 404 }
      );
    }

    // Cascade name changes across all collections that denormalize warehouseName
    if (oldName && newName && oldName !== newName) {
      await Promise.all([
        // 1. StockMovement updates
        StockMovement.updateMany(
          { $or: [{ warehouseId: id }, { warehouseName: oldName }] },
          { $set: { warehouseName: newName } }
        ),
        // 2. Invoice items
        Invoice.updateMany(
          { "items.warehouseId": id },
          { $set: { "items.$[elem].warehouseName": newName } },
          { arrayFilters: [{ "elem.warehouseId": id }] }
        ),
        Invoice.updateMany(
          { "items.warehouseName": oldName },
          { $set: { "items.$[elem].warehouseName": newName } },
          { arrayFilters: [{ "elem.warehouseName": oldName }] }
        ),
        // 3. EmployeeIssue items
        EmployeeIssue.updateMany(
          { "items.warehouseId": id },
          { $set: { "items.$[elem].warehouseName": newName } },
          { arrayFilters: [{ "elem.warehouseId": id }] }
        ),
        EmployeeIssue.updateMany(
          { "items.warehouseName": oldName },
          { $set: { "items.$[elem].warehouseName": newName } },
          { arrayFilters: [{ "elem.warehouseName": oldName }] }
        ),
      ]);
    }

    return Response.json({ success: true, data: warehouse });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("PUT warehouse error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to update warehouse",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only admin can delete warehouses" },
        { status: 403 }
      );
    }

    const warehouse = await Warehouse.findByIdAndDelete(id);

    if (!warehouse) {
      return Response.json(
        { success: false, message: "Warehouse not found" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, message: "Warehouse deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("DELETE warehouse error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to delete warehouse",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
