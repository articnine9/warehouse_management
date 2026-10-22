import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Invoice from "@/models/Invoice";
import Inventory from "@/models/Inventory";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return Response.json(
        {
          success: false,
          message: "Invoice not found",
        },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error("GET /api/billing/[id] error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to fetch invoice",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only admin can delete invoices" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return Response.json(
        { success: false, message: "Invoice not found" },
        { status: 404 }
      );
    }

    // Restore stock back to inventory if inventory records exist
    for (const item of invoice.items) {
      if (item.inventoryId && item.quantity > 0) {
        await Inventory.findByIdAndUpdate(item.inventoryId, {
          $inc: { quantity: item.quantity },
        });
      }
    }

    await Invoice.findByIdAndDelete(id);

    return Response.json({
      success: true,
      message: "Invoice deleted successfully and stock restored",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("DELETE /api/billing/[id] error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to delete invoice",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
