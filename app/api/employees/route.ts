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

export async function GET(request: Request) {
  try {
    await connectDB();
    await requireSessionUser();

    void Warehouse;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("search");
    const statusParam = searchParams.get("status");
    const warehouseParam = searchParams.get("warehouseId");
    const departmentParam = searchParams.get("department");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (statusParam && statusParam !== "ALL") {
      filter.status = statusParam;
    }

    if (warehouseParam && warehouseParam !== "ALL") {
      filter.warehouseId = warehouseParam;
    }

    if (departmentParam && departmentParam !== "ALL") {
      filter.department = departmentParam;
    }

    if (query?.trim()) {
      const regex = { $regex: query.trim(), $options: "i" };
      filter.$or = [
        { employeeCode: regex },
        { name: regex },
        { phone: regex },
        { email: regex },
        { department: regex },
        { designation: regex },
      ];
    }

    const employees = await Employee.find(filter)
      .populate("warehouseId", "name code")
      .sort({ employeeCode: 1 });

    // Aggregate active assets count for each employee
    const activeCountsMap = new Map<string, number>();
    try {
      const allIssues = await EmployeeIssue.find({}).lean();
      for (const issue of allIssues) {
        let activeUnitsInIssue = 0;
        for (const item of issue.items || []) {
          if (item.holdingStatus === "ACTIVE" || item.holdingStatus === "UNDER_SERVICE") {
            activeUnitsInIssue += item.quantity || 1;
          }
        }
        if (activeUnitsInIssue > 0) {
          const empIdStr = issue.employeeId?.toString();
          if (empIdStr) {
            activeCountsMap.set(empIdStr, (activeCountsMap.get(empIdStr) || 0) + activeUnitsInIssue);
          }
          if (issue.employeeName) {
            const nameKey = `name:${issue.employeeName.toLowerCase().trim()}`;
            activeCountsMap.set(nameKey, (activeCountsMap.get(nameKey) || 0) + activeUnitsInIssue);
          }
        }
      }
    } catch (countErr) {
      console.error("Failed to calculate active asset counts for employees:", countErr);
    }

    const data = employees.map((employee) => {
      const empIdStr = employee._id.toString();
      const nameKey = `name:${employee.name.toLowerCase().trim()}`;
      const count = activeCountsMap.get(empIdStr) || activeCountsMap.get(nameKey) || 0;
      return formatEmployee(employee as unknown as EmployeeDocument, count);
    });

    return Response.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("GET /api/employees error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to fetch employees",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const user = await requireSessionUser();

    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      return Response.json(
        { success: false, message: "Unauthorized to add employees" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name = String(body.name || "").trim();
    const department = String(body.department || "").trim();
    const designation = String(body.designation || "").trim();
    let employeeCode = String(body.employeeCode || "").trim().toUpperCase();

    if (!name) {
      return Response.json({ success: false, message: "Employee name is required" }, { status: 400 });
    }

    if (!department) {
      return Response.json({ success: false, message: "Department is required" }, { status: 400 });
    }

    if (!designation) {
      return Response.json({ success: false, message: "Designation is required" }, { status: 400 });
    }

    // Auto-generate employee code if missing
    if (!employeeCode) {
      const existingEmployees = await Employee.find({}, "employeeCode").lean();
      let maxNum = 0;
      for (const emp of existingEmployees) {
        const match = emp.employeeCode?.match(/^EMP(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      employeeCode = `EMP${String(maxNum + 1).padStart(3, "0")}`;
    }

    // Verify code uniqueness
    const existing = await Employee.findOne({ employeeCode });
    if (existing) {
      return Response.json(
        { success: false, message: `An employee with code "${employeeCode}" already exists` },
        { status: 409 }
      );
    }

    const employee = await Employee.create({
      name,
      employeeCode,
      phone: body.phone ? String(body.phone).trim() : undefined,
      email: body.email ? String(body.email).trim().toLowerCase() : undefined,
      department,
      designation,
      warehouseId: body.warehouseId || undefined,
      status: body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    });

    const populated = await Employee.findById(employee._id).populate("warehouseId", "name code");

    return Response.json(
      {
        success: true,
        data: formatEmployee(populated as unknown as EmployeeDocument, 0),
        message: `Employee "${name}" (${employeeCode}) created successfully`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("POST /api/employees error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to create employee",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
