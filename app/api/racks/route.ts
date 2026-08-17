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

    if (user.role !== "ADMIN") {
      return Response.json(
        {
          success: false,
          message: "Only admin can add racks",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const rack = await Rack.create({
      name: body.name,
      code: body.code,
      warehouseId: body.warehouseId,
      status: body.status ?? "ACTIVE",
    });

    return Response.json(
      {
        success: true,
        data: rack,
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
