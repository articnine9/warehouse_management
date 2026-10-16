import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Zone from "@/models/Zone";
import Rack from "@/models/Rack";
import Warehouse from "@/models/Warehouse";
import Inventory from "@/models/Inventory";
import Product from "@/models/Product";

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

    const zone = await Zone.findById(id).populate("warehouseId", "name code address");
    if (!zone) {
      return Response.json(
        { success: false, message: "Zone not found" },
        { status: 404 }
      );
    }

    // Get all racks in this zone
    const racks = await Rack.find({ zoneId: id })
      .populate("warehouseId", "name code")
      .sort({ code: 1 });

    const rackIds = racks.map((r) => r._id);

    // Get inventory for all racks in this zone
    const inventory = await Inventory.find({ rackId: { $in: rackIds } })
      .populate("productId", "name sku price category unit")
      .populate("rackId", "name code")
      .sort({ updatedAt: -1 });

    // Per-rack product counts
    const rackProductCounts = await Inventory.aggregate([
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
      rackProductCounts.map((item) => [
        item._id.toString(),
        { productCount: item.productCount, totalUnits: item.totalUnits },
      ])
    );

    const racksData = racks.map((r) => {
      const stats = rackStatsMap.get(r._id.toString());
      return {
        ...r.toObject(),
        productCount: stats?.productCount || 0,
        totalUnits: stats?.totalUnits || 0,
      };
    });

    const totalUnits = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const lowStockCount = inventory.filter((item) => item.status === "LOW_STOCK").length;
    const outOfStockCount = inventory.filter((item) => item.status === "OUT_OF_STOCK").length;

    return Response.json({
      success: true,
      data: {
        zone,
        racks: racksData,
        inventory,
        summary: {
          totalRacks: racks.length,
          totalProducts: inventory.length,
          totalUnits,
          lowStockCount,
          outOfStockCount,
        },
      },
    });
  } catch (error) {
    console.error("GET zone [id] error:", error);
    return Response.json(
      { success: false, message: "Failed to fetch zone details" },
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

    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      return Response.json(
        { success: false, message: "Unauthorized to update zones" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const oldZone = await Zone.findById(id);
    if (!oldZone) {
      return Response.json(
        { success: false, message: "Zone not found" },
        { status: 404 }
      );
    }

    const zone = await Zone.findByIdAndUpdate(
      id,
      {
        name: body.name ? String(body.name).trim() : oldZone.name,
        code: body.code ? String(body.code).trim() : oldZone.code,
        warehouseId: body.warehouseId || oldZone.warehouseId,
        status: body.status || oldZone.status,
      },
      { new: true }
    ).populate("warehouseId", "name code");

    if (!zone) {
      return Response.json(
        { success: false, message: "Zone not found" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: zone });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("PUT zone error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to update zone",
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
        { success: false, message: "Only admin can delete zones" },
        { status: 403 }
      );
    }

    // Check if zone has racks
    const rackCount = await Rack.countDocuments({ zoneId: id });
    if (rackCount > 0) {
      return Response.json(
        {
          success: false,
          message: `Cannot delete zone: ${rackCount} rack(s) are assigned to this zone. Remove or reassign them first.`,
        },
        { status: 400 }
      );
    }

    const zone = await Zone.findByIdAndDelete(id);

    if (!zone) {
      return Response.json(
        { success: false, message: "Zone not found" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, message: "Zone deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("DELETE zone error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to delete zone",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
