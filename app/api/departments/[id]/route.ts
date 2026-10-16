import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Department from "@/models/Department";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    await requireSessionUser();

    const { id } = await params;
    const body = await request.json();

    const name = String(body.name || "").trim();
    const code = String(body.code || "").trim().toUpperCase();
    const description = String(body.description || "").trim();
    const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    if (!name) {
      return Response.json(
        { success: false, message: "Department name is required" },
        { status: 400 }
      );
    }

    // Check if another department with the same name exists
    const duplicate = await Department.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });

    if (duplicate) {
      return Response.json(
        { success: false, message: `Another department named "${duplicate.name}" already exists` },
        { status: 400 }
      );
    }

    const updated = await Department.findByIdAndUpdate(
      id,
      {
        name,
        code: code || undefined,
        description: description || undefined,
        status,
      },
      { new: true }
    );

    if (!updated) {
      return Response.json(
        { success: false, message: "Department not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: "Department updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("PUT /api/departments/[id] error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to update department",
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
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only administrators can delete departments" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const deleted = await Department.findByIdAndDelete(id);

    if (!deleted) {
      return Response.json(
        { success: false, message: "Department not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/departments/[id] error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to delete department",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
