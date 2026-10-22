import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import ProductHistory from "@/models/ProductHistory";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only admin can delete history records" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const history = await ProductHistory.findByIdAndDelete(id);

    if (!history) {
      return Response.json(
        { success: false, message: "History record not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: "History record deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("DELETE /api/product-history/[id] error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to delete history record",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
