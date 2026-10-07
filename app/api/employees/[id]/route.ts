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

function formatEmployee(employee: EmployeeDocument, activeAssetsCount: number = 0) {
  const warehouse = employee.warehouseId;

  return {
    id: employee._id.toString(),
    employeeCode: employee.employeeCode,
    name: employee.name,
    phone: employee.phone || "",
    email: employee.email || "",
    department: employee.department,
    designation: employee.designation,
    status: employee.status,
    activeAssetsCount,
    warehouse: isPopulatedWarehouse(warehouse)
      ? {
          id: warehouse._id.toString(),
          name: warehouse.name,
          code: warehouse.code,
        }
      : null,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
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
      return Response.json({ success: false, message: "Employee not found" }, { status: 404 });
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
      data: formatEmployee(employee as unknown as EmployeeDocument, activeAssetsCount),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("GET /api/employees/[id] error:", error);
    return Response.json(
      { success: false, message: "Failed to fetch employee", error: String(error) },
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
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only administrators can update employees" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const existing = await Employee.findById(id);
    if (!existing) {
      return Response.json({ success: false, message: "Employee not found" }, { status: 404 });
    }

    const body = await request.json();

    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    const department = body.department !== undefined ? String(body.department).trim() : existing.department;
    const designation = body.designation !== undefined ? String(body.designation).trim() : existing.designation;
    const employeeCode = body.employeeCode !== undefined ? String(body.employeeCode).trim().toUpperCase() : existing.employeeCode;
    const phone = body.phone !== undefined ? String(body.phone).trim() : existing.phone;
    const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : existing.email;
    const warehouseId = body.warehouseId !== undefined ? (body.warehouseId || null) : existing.warehouseId;
    const status = body.status !== undefined ? (body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") : existing.status;

    if (!name) {
      return Response.json({ success: false, message: "Employee name cannot be empty" }, { status: 400 });
    }
    if (!department) {
      return Response.json({ success: false, message: "Department cannot be empty" }, { status: 400 });
    }
    if (!designation) {
      return Response.json({ success: false, message: "Designation cannot be empty" }, { status: 400 });
    }

    // If employee code changed, check uniqueness
    if (employeeCode !== existing.employeeCode) {
      const duplicateCode = await Employee.findOne({ employeeCode, _id: { $ne: id } });
      if (duplicateCode) {
        return Response.json(
          { success: false, message: `Employee code "${employeeCode}" is already in use by another employee` },
          { status: 409 }
        );
      }
    }

    existing.name = name;
    existing.department = department;
    existing.designation = designation;
    existing.employeeCode = employeeCode;
    existing.phone = phone || undefined;
    existing.email = email || undefined;
    existing.warehouseId = warehouseId || undefined;
    existing.status = status;

    await existing.save();

    // Propagate updated name/dept/phone/email to EmployeeIssue records for consistency
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
      console.error("Failed to sync employee info to issues:", syncErr);
    }

    const populated = await Employee.findById(id).populate("warehouseId", "name code");

    return Response.json({
      success: true,
      data: formatEmployee(populated as unknown as EmployeeDocument),
      message: "Employee updated successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("PUT /api/employees/[id] error:", error);
    return Response.json(
      { success: false, message: "Failed to update employee", error: String(error) },
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
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only administrators can remove employees" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const employee = await Employee.findById(id);

    if (!employee) {
      return Response.json({ success: false, message: "Employee not found" }, { status: 404 });
    }

    // Safety check: Check if employee has active issued assets
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
          message: `Cannot remove employee "${employee.name}". They currently have ${activeUnitsCount} active asset unit(s) assigned. Please return all assets first, or set employee status to INACTIVE.`,
        },
        { status: 400 }
      );
    }

    await Employee.findByIdAndDelete(id);

    return Response.json({
      success: true,
      message: `Employee "${employee.name}" (${employee.employeeCode}) was removed successfully.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("DELETE /api/employees/[id] error:", error);
    return Response.json(
      { success: false, message: "Failed to delete employee", error: String(error) },
      { status: 500 }
    );
  }
}
