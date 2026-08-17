import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import User from "@/models/User";

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
        { success: false, message: "Only admin can delete staff" },
        { status: 403 }
      );
    }

    const staffMember = await User.findById(id);

    if (!staffMember) {
      return Response.json(
        { success: false, message: "Staff not found" },
        { status: 404 }
      );
    }

    if (staffMember.role === "ADMIN") {
      return Response.json(
        { success: false, message: "Cannot delete admin users" },
        { status: 400 }
      );
    }

    await User.findByIdAndDelete(id);

    return Response.json({ success: true, message: "Staff deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("DELETE staff error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to delete staff",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
