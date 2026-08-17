import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Rack from "@/models/Rack";

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

    const rack = await Rack.findByIdAndUpdate(
      id,
      {
        name: body.name,
        code: body.code,
        warehouseId: body.warehouseId,
        status: body.status,
      },
      { new: true }
    ).populate("warehouseId", "name code");

    if (!rack) {
      return Response.json(
        { success: false, message: "Rack not found" },
        { status: 404 }
      );
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
