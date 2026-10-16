import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Zone from "@/models/Zone";
import Rack from "@/models/Rack";

export async function GET() {
  try {
    await connectDB();
    await requireSessionUser();

    const zones = await Zone.find()
      .populate("warehouseId", "name code")
      .sort({ createdAt: -1 });

    const zoneIds = zones.map((z) => z._id);

    const rackCounts = await Rack.aggregate([
      { $match: { zoneId: { $in: zoneIds } } },
      { $group: { _id: "$zoneId", rackCount: { $sum: 1 } } },
    ]);

    const rackCountMap = new Map(
      rackCounts.map((item) => [item._id.toString(), item.rackCount])
    );

    const data = zones.map((z) => ({
      ...z.toObject(),
      rackCount: rackCountMap.get(z._id.toString()) || 0,
    }));

    return Response.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error("GET zones error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to fetch zones",
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
          message: "Unauthorized to add zones",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.warehouseId) {
      return Response.json(
        {
          success: false,
          message: "Please select a warehouse for this zone",
        },
        { status: 400 }
      );
    }

    const trimmedName = body.name ? String(body.name).trim() : "";
    if (!trimmedName) {
      return Response.json(
        {
          success: false,
          message: "Zone name is required",
        },
        { status: 400 }
      );
    }

    const zone = await Zone.create({
      name: trimmedName,
      code: body.code ? String(body.code).trim().toUpperCase() : "",
      warehouseId: body.warehouseId,
      status: body.status ?? "ACTIVE",
    });

    return Response.json(
      {
        success: true,
        data: zone,
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

    console.error("POST zone error:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return Response.json(
      {
        success: false,
        message: errorMessage || "Failed to create zone",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
