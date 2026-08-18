import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Employee from "@/models/Employee";
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

function formatEmployee(employee: EmployeeDocument) {
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
    warehouse: isPopulatedWarehouse(warehouse)
      ? {
          id: warehouse._id.toString(),
          name: warehouse.name,
          code: warehouse.code,
        }
      : null,
  };
}

export async function GET(request: Request) {
  try {
    await connectDB();
    await requireSessionUser();

    void Warehouse;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("search");

    const filter: {
      status: "ACTIVE";
      $or?: { [key: string]: { $regex: string; $options: string } }[];
    } = { status: "ACTIVE" };

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

    return Response.json({
      success: true,
      data: employees.map((employee) => formatEmployee(employee as unknown as EmployeeDocument)),
      count: employees.length,
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
