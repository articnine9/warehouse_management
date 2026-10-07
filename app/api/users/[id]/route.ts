import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Employee from "@/models/Employee";
import EmployeeIssue from "@/models/EmployeeIssue";
import Warehouse from "@/models/Warehouse";

type PopulatedWarehouse = {
  _id: { toString(): string };
  name: string;
  code: string;
};

type EmployeeDocument = {
  _id: { toString(): string };
  employeeCode: string;
  name: string;
  phone?: string;
  email?: string;
  department: string;
  designation: string;
  status: "ACTIVE" | "INACTIVE";
  warehouseId?: PopulatedWarehouse | null;
  createdAt?: Date;
  updatedAt?: Date;
};

function isPopulatedWarehouse(value: unknown): value is PopulatedWarehouse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "_id" in value &&
      "name" in value &&
      "code" in value
  );
}

function formatUser(userDoc: EmployeeDocument, activeAssetsCount: number = 0) {
  const warehouse = userDoc.warehouseId;

  return {
    id: userDoc._id.toString(),
    userCode: userDoc.employeeCode,
    employeeCode: userDoc.employeeCode,
    name: userDoc.name,
    phone: userDoc.phone || "",
    email: userDoc.email || "",
    department: userDoc.department,
    designation: userDoc.designation,
    status: userDoc.status,
    activeAssetsCount,
    warehouse: isPopulatedWarehouse(warehouse)
      ? {
          id: warehouse._id.toString(),
          name: warehouse.name,
          code: warehouse.code,
        }
      : null,
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    await requireSessionUser();

    void Warehouse;

    const { id } = await params;
    const employee = await Employee.findById(id).populate("warehouseId", "name code");

    if (!employee) {
      return Response.json({ success: false, message: "User not found" }, { status: 404 });
    }

    // Calculate active assets count
    const issues = await EmployeeIssue.find({
      $or: [{ employeeId: id }, { employeeName: employee.name }],
    }).lean();

    let activeAssetsCount = 0;
    for (const issue of issues) {
      for (const item of issue.items || []) {
        if (item.holdingStatus === "ACTIVE" || item.holdingStatus === "UNDER_SERVICE") {
          activeAssetsCount += item.quantity || 1;
        }
      }
    }

    return Response.json({
      success: true,
      data: formatUser(employee as unknown as EmployeeDocument, activeAssetsCount),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("GET /api/users/[id] error:", error);
    return Response.json(
      { success: false, message: "Failed to fetch user", error: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const sessionUser = await requireSessionUser();

    if (sessionUser.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only administrators can update users" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const existing = await Employee.findById(id);
    if (!existing) {
      return Response.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const body = await request.json();

    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    const department = body.department !== undefined ? String(body.department).trim() : existing.department;
    const designation = body.designation !== undefined ? String(body.designation).trim() : existing.designation;
    const userCode = body.userCode !== undefined
      ? String(body.userCode).trim().toUpperCase()
      : body.employeeCode !== undefined
      ? String(body.employeeCode).trim().toUpperCase()
      : existing.employeeCode;
    const phone = body.phone !== undefined ? String(body.phone).trim() : existing.phone;
    const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : existing.email;
    const warehouseId = body.warehouseId !== undefined ? (body.warehouseId || null) : existing.warehouseId;
    const status = body.status !== undefined ? (body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") : existing.status;

    if (!name) {
      return Response.json({ success: false, message: "User name cannot be empty" }, { status: 400 });
    }
    if (!department) {
      return Response.json({ success: false, message: "Department cannot be empty" }, { status: 400 });
    }
    if (!designation) {
      return Response.json({ success: false, message: "Designation cannot be empty" }, { status: 400 });
    }

    // Check code uniqueness
    if (userCode !== existing.employeeCode) {
      const duplicateCode = await Employee.findOne({ employeeCode: userCode, _id: { $ne: id } });
      if (duplicateCode) {
        return Response.json(
          { success: false, message: `User code "${userCode}" is already in use by another user` },
          { status: 409 }
        );
      }
    }

    existing.name = name;
    existing.department = department;
    existing.designation = designation;
    existing.employeeCode = userCode;
    existing.phone = phone || undefined;
    existing.email = email || undefined;
    existing.warehouseId = warehouseId || undefined;
    existing.status = status;

    await existing.save();

    // Sync info to EmployeeIssue
    try {
      await EmployeeIssue.updateMany(
        { employeeId: id },
        {
          $set: {
            employeeName: name,
            employeeDepartment: department,
            employeeEmail: email || "",
            employeePhone: phone || "",
          },
        }
      );
    } catch (syncErr) {
      console.error("Failed to sync user info to issues:", syncErr);
    }

    const populated = await Employee.findById(id).populate("warehouseId", "name code");

    return Response.json({
      success: true,
      data: formatUser(populated as unknown as EmployeeDocument),
      message: "User updated successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("PUT /api/users/[id] error:", error);
    return Response.json(
      { success: false, message: "Failed to update user", error: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const sessionUser = await requireSessionUser();

    if (sessionUser.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only administrators can remove users" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const employee = await Employee.findById(id);

    if (!employee) {
      return Response.json({ success: false, message: "User not found" }, { status: 404 });
    }

    // Safety check: Check if user has active issued assets
    const activeIssues = await EmployeeIssue.find({
      $or: [{ employeeId: id }, { employeeName: employee.name }],
      "items.holdingStatus": { $in: ["ACTIVE", "UNDER_SERVICE"] },
    }).lean();

    let activeUnitsCount = 0;
    for (const issue of activeIssues) {
      for (const item of issue.items || []) {
        if (item.holdingStatus === "ACTIVE" || item.holdingStatus === "UNDER_SERVICE") {
          activeUnitsCount += item.quantity || 1;
        }
      }
    }

    if (activeUnitsCount > 0) {
      return Response.json(
        {
          success: false,
          hasActiveAssets: true,
          activeUnitsCount,
          message: `Cannot remove user "${employee.name}". They currently have ${activeUnitsCount} active asset unit(s) assigned. Please return all assets first, or set user status to INACTIVE.`,
        },
        { status: 400 }
      );
    }

    await Employee.findByIdAndDelete(id);

    return Response.json({
      success: true,
      message: `User "${employee.name}" (${employee.employeeCode}) was removed successfully.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("DELETE /api/users/[id] error:", error);
    return Response.json(
      { success: false, message: "Failed to delete user", error: String(error) },
      { status: 500 }
    );
  }
}
