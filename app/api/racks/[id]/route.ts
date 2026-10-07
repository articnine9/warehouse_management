import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Rack from "@/models/Rack";
import Warehouse from "@/models/Warehouse";
import Inventory from "@/models/Inventory";
import Product from "@/models/Product";
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
    void Warehouse;

    const rack = await Rack.findById(id).populate("warehouseId", "name code address");
    if (!rack) {
      return Response.json(
        { success: false, message: "Rack not found" },
        { status: 404 }
      );
    }

    const inventory = await Inventory.find({ rackId: id })
      .populate("productId", "name sku price category unit")
      .populate("warehouseId", "name code")
      .sort({ updatedAt: -1 });

    const totalUnits = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const lowStockCount = inventory.filter((item) => item.status === "LOW_STOCK").length;
    const outOfStockCount = inventory.filter((item) => item.status === "OUT_OF_STOCK").length;

    return Response.json({
      success: true,
      data: {
        rack,
        inventory,
        summary: {
          totalProducts: inventory.length,
          totalUnits,
          lowStockCount,
          outOfStockCount,
        },
      },
    });
  } catch (error) {
    console.error("GET rack [id] error:", error);
    return Response.json(
      { success: false, message: "Failed to fetch rack details" },
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
        { success: false, message: "Only admin can update racks" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const oldRack = await Rack.findById(id);
    if (!oldRack) {
      return Response.json(
        { success: false, message: "Rack not found" },
        { status: 404 }
      );
    }

    const oldName = oldRack.name;
    const newName = body.name ? String(body.name).trim() : oldName;

    const rack = await Rack.findByIdAndUpdate(
      id,
      {
        name: newName,
        code: body.code ? String(body.code).trim() : oldRack.code,
        warehouseId: body.warehouseId || oldRack.warehouseId,
        status: body.status || oldRack.status,
      },
      { new: true }
    ).populate("warehouseId", "name code");

    if (!rack) {
      return Response.json(
        { success: false, message: "Rack not found" },
        { status: 404 }
      );
    }

    // Cascade rack name changes across collections
    if (oldName && newName && oldName !== newName) {
      await Promise.all([
        StockMovement.updateMany(
          { $or: [{ rackId: id }, { rackName: oldName }] },
          { $set: { rackName: newName } }
        ),
        Invoice.updateMany(
          { "items.rackId": id },
          { $set: { "items.$[elem].rackName": newName } },
          { arrayFilters: [{ "elem.rackId": id }] }
        ),
        Invoice.updateMany(
          { "items.rackName": oldName },
          { $set: { "items.$[elem].rackName": newName } },
          { arrayFilters: [{ "elem.rackName": oldName }] }
        ),
        EmployeeIssue.updateMany(
          { "items.rackId": id },
          { $set: { "items.$[elem].rackName": newName } },
          { arrayFilters: [{ "elem.rackId": id }] }
        ),
        EmployeeIssue.updateMany(
          { "items.rackName": oldName },
          { $set: { "items.$[elem].rackName": newName } },
          { arrayFilters: [{ "elem.rackName": oldName }] }
        ),
      ]);
    }

    return Response.json({ success: true, data: rack });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("PUT rack error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to update rack",
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
        { success: false, message: "Only admin can delete racks" },
        { status: 403 }
      );
    }

    const rack = await Rack.findByIdAndDelete(id);

    if (!rack) {
      return Response.json(
        { success: false, message: "Rack not found" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, message: "Rack deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("DELETE rack error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to delete rack",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
