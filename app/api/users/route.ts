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

    const users = await Employee.find(filter)
      .populate("warehouseId", "name code")
      .sort({ employeeCode: 1 });

    // Aggregate active assets count for each user
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
      console.error("Failed to calculate active asset counts for users:", countErr);
    }

    const data = users.map((u) => {
      const idStr = u._id.toString();
      const nameKey = `name:${u.name.toLowerCase().trim()}`;
      const count = activeCountsMap.get(idStr) || activeCountsMap.get(nameKey) || 0;
      return formatUser(u as unknown as EmployeeDocument, count);
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

    console.error("GET /api/users error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to fetch users",
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

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only administrators can add users" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name = String(body.name || "").trim();
    const department = String(body.department || "").trim();
    const designation = String(body.designation || "").trim();
    let userCode = String(body.userCode || body.employeeCode || "").trim().toUpperCase();

    if (!name) {
      return Response.json({ success: false, message: "User name is required" }, { status: 400 });
    }

    if (!department) {
      return Response.json({ success: false, message: "Department is required" }, { status: 400 });
    }

    if (!designation) {
      return Response.json({ success: false, message: "Designation is required" }, { status: 400 });
    }

    // Auto-generate code if missing
    if (!userCode) {
      const existing = await Employee.find({}, "employeeCode").lean();
      let maxNum = 0;
      for (const item of existing) {
        const match = item.employeeCode?.match(/^(?:USR|EMP)(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      userCode = `USR${String(maxNum + 1).padStart(3, "0")}`;
    }

    // Verify code uniqueness
    const existingUser = await Employee.findOne({ employeeCode: userCode });
    if (existingUser) {
      return Response.json(
        { success: false, message: `A user with code "${userCode}" already exists` },
        { status: 409 }
      );
    }

    const created = await Employee.create({
      name,
      employeeCode: userCode,
      phone: body.phone ? String(body.phone).trim() : undefined,
      email: body.email ? String(body.email).trim().toLowerCase() : undefined,
      department,
      designation,
      warehouseId: body.warehouseId || undefined,
      status: body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    });

    const populated = await Employee.findById(created._id).populate("warehouseId", "name code");

    return Response.json(
      {
        success: true,
        data: formatUser(populated as unknown as EmployeeDocument, 0),
        message: `User "${name}" (${userCode}) created successfully`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("POST /api/users error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to create user",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
