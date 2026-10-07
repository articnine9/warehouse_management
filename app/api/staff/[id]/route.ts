import { connectDB } from "@/lib/mongodb";
import { requireSessionUser, hashPassword, toSafeUser } from "@/lib/auth";
import User from "@/models/User";
import Warehouse from "@/models/Warehouse";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const currentUser = await requireSessionUser();

    if (currentUser.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only administrators can update staff accounts" },
        { status: 403 }
      );
    }

    const staffMember = await User.findById(id);
    if (!staffMember) {
      return Response.json(
        { success: false, message: "Staff member not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const role = body.role === "ADMIN" ? "ADMIN" : "STAFF";
    const warehouseIds = Array.isArray(body.warehouseIds)
      ? body.warehouseIds.map((id: string) => id.trim()).filter(Boolean)
      : body.warehouseId
        ? [body.warehouseId.trim()]
        : [];
    const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    const newPassword = body.password?.trim();

    if (!name || !email) {
      return Response.json(
        { success: false, message: "Name and email are required" },
        { status: 400 }
      );
    }

    if (role === "STAFF" && warehouseIds.length === 0) {
      return Response.json(
        { success: false, message: "Please assign at least one warehouse for staff members" },
        { status: 400 }
      );
    }

    // Check if email changed and is already taken
    if (email !== staffMember.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return Response.json(
          { success: false, message: "An account with this email already exists" },
          { status: 409 }
        );
      }
    }

    if (warehouseIds.length > 0) {
      const warehouses = await Warehouse.find({ _id: { $in: warehouseIds } });
      if (warehouses.length !== warehouseIds.length) {
        return Response.json(
          { success: false, message: "One or more selected warehouses do not exist" },
          { status: 404 }
        );
      }
    }

    staffMember.name = name;
    staffMember.email = email;
    staffMember.role = role;
    staffMember.warehouseIds = role === "STAFF" ? warehouseIds : [];
    staffMember.warehouseId = role === "STAFF" ? (warehouseIds[0] || null) : null;
    staffMember.status = status;

    // If new password is provided, validate and update hash
    if (newPassword) {
      if (newPassword.length < 6) {
        return Response.json(
          { success: false, message: "New password must be at least 6 characters" },
          { status: 400 }
        );
      }
      staffMember.passwordHash = await hashPassword(newPassword);
    }

    await staffMember.save();

    const updatedUser = await User.findById(id)
      .select("-passwordHash")
      .populate("warehouseIds", "name code address");

    return Response.json({
      success: true,
      message: "Staff member updated successfully",
      data: toSafeUser(updatedUser!),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("PUT staff error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to update staff member",
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
