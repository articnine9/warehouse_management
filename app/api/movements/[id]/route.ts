import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import StockMovement from "@/models/StockMovement";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only admin can delete stock movement records" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const movement = await StockMovement.findByIdAndDelete(id);

    if (!movement) {
      return Response.json(
        { success: false, message: "Movement record not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: "Movement record deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("DELETE /api/movements/[id] error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to delete movement record",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
