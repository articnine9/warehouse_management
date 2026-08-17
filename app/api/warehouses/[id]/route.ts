import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Warehouse from "@/models/Warehouse";

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

    const warehouse = await Warehouse.findByIdAndUpdate(
      id,
      {
        name: body.name,
        code: body.code,
        address: body.address,
        status: body.status,
      },
      { new: true }
    );

    if (!warehouse) {
      return Response.json(
        { success: false, message: "Warehouse not found" },
        { status: 404 }
      );
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
