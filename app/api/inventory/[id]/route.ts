import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Inventory from "@/models/Inventory";

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
        { success: false, message: "Only admin can update inventory" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const { productId, warehouseId, rackId, quantity } = body;

    let status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";

    if (quantity === 0) {
      status = "OUT_OF_STOCK";
    } else if (quantity <= 10) {
      status = "LOW_STOCK";
    } else {
      status = "AVAILABLE";
    }

    const inventory = await Inventory.findByIdAndUpdate(
      id,
      {
        productId,
        warehouseId,
        rackId,
        quantity,
        status,
      },
      { new: true }
    )
      .populate("productId", "name sku")
      .populate("warehouseId", "name code")
      .populate("rackId", "name code");

    if (!inventory) {
      return Response.json(
        { success: false, message: "Inventory not found" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: inventory });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("PUT inventory error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to update inventory",
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
        { success: false, message: "Only admin can delete inventory" },
        { status: 403 }
      );
    }

    const inventory = await Inventory.findByIdAndDelete(id);

    if (!inventory) {
      return Response.json(
        { success: false, message: "Inventory not found" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, message: "Inventory deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("DELETE inventory error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to delete inventory",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
