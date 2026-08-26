import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Inventory from "@/models/Inventory";
import StockMovement from "@/models/StockMovement";

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

    const oldInventory = await Inventory.findById(id).lean();
    if (!oldInventory) {
      return Response.json(
        { success: false, message: "Inventory not found" },
        { status: 404 }
      );
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
      .populate("productId", "name sku price category")
      .populate("warehouseId", "name code")
      .populate("rackId", "name code");

    if (!inventory) {
      return Response.json(
        { success: false, message: "Inventory not found" },
        { status: 404 }
      );
    }

    const diff = Number(quantity) - Number(oldInventory.quantity || 0);
    if (diff !== 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = inventory.productId as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = inventory.warehouseId as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = inventory.rackId as any;

        if (p) {
          await StockMovement.create({
            productId: p._id,
            productName: p.name,
            sku: p.sku,
            category: p.category,
            warehouseId: w?._id,
            warehouseName: w?.name,
            rackId: r?._id,
            rackName: r?.name,
            movementType: diff > 0 ? "INWARD" : "OUTWARD",
            reason: diff > 0 ? "RESTOCK" : "ADJUSTMENT",
            quantity: Math.abs(diff),
            unitPrice: p.price || 0,
            totalValue: (p.price || 0) * Math.abs(diff),
            referenceNumber: "STOCK-ADJUSTMENT",
            entityName: `${w?.name || "Warehouse"} / ${r?.name || "Rack"}`,
            notes: `Quantity changed from ${oldInventory.quantity} to ${quantity}`,
            performedBy: user.id,
            performedByName: user.name,
          });
        }
      } catch (logErr) {
        console.error("Failed to log movement in PUT inventory:", logErr);
      }
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
