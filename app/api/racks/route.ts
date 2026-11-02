import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Rack from "@/models/Rack";
import Inventory from "@/models/Inventory";

export async function GET() {
  try {
    await connectDB();
    await requireSessionUser();

    const racks = await Rack.find()
      .populate("warehouseId", "name code")
      .populate("zoneId", "name code")
      .sort({
        createdAt: -1,
      });

    const rackIds = racks.map((r) => r._id);

    const productCounts = await Inventory.aggregate([
      { $match: { rackId: { $in: rackIds } } },
      { $group: { _id: "$rackId", productCount: { $sum: 1 } } },
    ]);

    const countMap = new Map(
      productCounts.map((item) => [item._id.toString(), item.productCount])
    );

    const data = racks.map((r) => ({
      ...r.toObject(),
      productCount: countMap.get(r._id.toString()) || 0,
    }));

    return Response.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error("GET racks error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to fetch racks",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const user = await requireSessionUser();

    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      return Response.json(
        {
          success: false,
          message: "Unauthorized to add racks",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.warehouseId) {
      return Response.json(
        { success: false, message: "Warehouse is required for rack" },
        { status: 400 }
      );
    }

    if (!body.zoneId) {
      return Response.json(
        { success: false, message: "Zone is required for rack. Every rack must belong to a zone." },
        { status: 400 }
      );
    }

    const trimmedName = body.name ? String(body.name).trim() : "";
    const trimmedCode = body.code ? String(body.code).trim().toUpperCase() : "";

    if (!trimmedName) {
      return Response.json(
        { success: false, message: "Rack name is required" },
        { status: 400 }
      );
    }

    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existingRack = await Rack.findOne({
      warehouseId: body.warehouseId,
      zoneId: body.zoneId,
      name: { $regex: new RegExp(`^${escapedName}$`, "i") },
    })
      .populate("warehouseId", "name code")
      .populate("zoneId", "name code");

    if (existingRack) {
      return Response.json(
        {
          success: true,
          data: existingRack,
          message: "Rack already exists in this zone, reused existing rack",
        },
        { status: 200 }
      );
    }

    const rack = await Rack.create({
      name: trimmedName,
      code: trimmedCode || trimmedName.toUpperCase(),
      warehouseId: body.warehouseId,
      zoneId: body.zoneId,
      status: body.status ?? "ACTIVE",
    });

    const populatedRack = await Rack.findById(rack._id)
      .populate("warehouseId", "name code")
      .populate("zoneId", "name code");

    return Response.json(
      {
        success: true,
        data: populatedRack || rack,
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

    console.error("POST rack error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to create rack",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
