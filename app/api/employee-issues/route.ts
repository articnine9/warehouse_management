import { connectDB } from "@/lib/mongodb";
import { getUserWarehouseId, requireSessionUser } from "@/lib/auth";
import Employee from "@/models/Employee";
import EmployeeIssue from "@/models/EmployeeIssue";
import Inventory from "@/models/Inventory";
import Product from "@/models/Product";
import Rack from "@/models/Rack";
import Warehouse from "@/models/Warehouse";

const allowedReasons = new Set([
  "STAFF_USE",
  "OFFICE_USE",
  "UNIFORM",
  "REPLACEMENT",
  "OTHER",
]);

function getNextStatus(quantity: number) {
  if (quantity === 0) return "OUT_OF_STOCK";
  if (quantity <= 10) return "LOW_STOCK";
  return "AVAILABLE";
}

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
    const currentUser = await requireSessionUser();

    void Product;
    void Rack;
    void Warehouse;
    void Inventory;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("search");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (query?.trim()) {
      const regex = { $regex: query.trim(), $options: "i" };
      filter.$or = [
        { issueNumber: regex },
        { employeeName: regex },
        { employeeEmail: regex },
        { reason: regex },
        { issuedByName: regex },
      ];
    }

    if (currentUser.role === "STAFF") {
      filter.issuedBy = currentUser._id;
    }

    const [issues, employees] = await Promise.all([
      EmployeeIssue.find(filter).sort({ createdAt: -1 }).limit(200),
      Employee.find({ status: "ACTIVE" })
        .populate("warehouseId", "name code")
        .sort({ employeeCode: 1 }),
    ]);

    return Response.json({
      success: true,
      data: issues,
      employees: employees.map((employee) => formatEmployee(employee as unknown as EmployeeDocument)),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("GET /api/employee-issues error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to fetch employee issues",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const currentUser = await requireSessionUser();

    void Product;
    void Rack;
    void Warehouse;

    const body = await request.json();
    const employeeId = body.employeeId?.trim();
    const reason = allowedReasons.has(body.reason) ? body.reason : "STAFF_USE";
    const notes = body.notes?.trim() || "";
    const items = body.items;

    if (!employeeId) {
      return Response.json({ success: false, message: "Please select an employee" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json(
        { success: false, message: "Please add at least one product" },
        { status: 400 }
      );
    }

    const employee = await Employee.findOne({ _id: employeeId, status: "ACTIVE" });

    if (!employee) {
      return Response.json(
        { success: false, message: "Selected employee was not found or is inactive" },
        { status: 404 }
      );
    }

    const staffWarehouseId = getUserWarehouseId(currentUser);
    const issueItems = [];
    let totalQuantity = 0;
    let totalValue = 0;

    for (const item of items) {
      const inventoryId = item.inventoryId;
      const qtyNum = Number(item.quantity);

      if (!inventoryId || !qtyNum || qtyNum <= 0) {
        return Response.json(
          { success: false, message: "Invalid product or quantity" },
          { status: 400 }
        );
      }

      const inventory = await Inventory.findById(inventoryId)
        .populate("productId")
        .populate("warehouseId")
        .populate("rackId");

      if (!inventory) {
        return Response.json(
          { success: false, message: `Inventory item not found for ID ${inventoryId}` },
          { status: 404 }
        );
      }

      if (
        currentUser.role === "STAFF" &&
        staffWarehouseId &&
        inventory.warehouseId._id.toString() !== staffWarehouseId.toString()
      ) {
        return Response.json(
          { success: false, message: "You can issue products only from your assigned warehouse" },
          { status: 403 }
        );
      }

      if (inventory.quantity < qtyNum) {
        const productName =
          typeof inventory.productId === "object" && "name" in inventory.productId
            ? inventory.productId.name
            : "Selected product";
        return Response.json(
          {
            success: false,
            message: `Insufficient stock for "${productName}". Available: ${inventory.quantity}, Requested: ${qtyNum}`,
          },
          { status: 400 }
        );
      }

      const product = inventory.productId as typeof Product.prototype;
      const warehouse = inventory.warehouseId as typeof Warehouse.prototype;
      const rack = inventory.rackId as typeof Rack.prototype;
      const unitPrice = Number(product.price) || 0;
      const lineValue = unitPrice * qtyNum;

      const newQty = inventory.quantity - qtyNum;
      inventory.quantity = newQty;
      inventory.status = getNextStatus(newQty);
      await inventory.save();

      totalQuantity += qtyNum;
      totalValue += lineValue;

      const warrantyMonths = Number(item.warrantyMonths) || 0;
      const warrantyStartDate = item.warrantyStartDate ? new Date(item.warrantyStartDate) : new Date();
      let warrantyEndDate = item.warrantyEndDate ? new Date(item.warrantyEndDate) : undefined;
      if (!warrantyEndDate && warrantyMonths > 0) {
        warrantyEndDate = new Date(warrantyStartDate);
        warrantyEndDate.setMonth(warrantyEndDate.getMonth() + warrantyMonths);
      }

      const serviceIntervalMonths = Number(item.serviceIntervalMonths) || 0;

      issueItems.push({
        inventoryId: inventory._id,
        productId: product._id,
        productName: product.name || "Product",
        sku: product.sku || "N/A",
        warehouseId: warehouse._id,
        warehouseName: warehouse.name || "Warehouse",
        rackId: rack._id,
        rackName: rack.name || "Rack",
        quantity: qtyNum,
        unitPrice,
        totalValue: lineValue,
        serialNumber: item.serialNumber?.trim() || undefined,
        warrantyMonths,
        warrantyStartDate,
        warrantyEndDate,
        serviceIntervalMonths,
        serviceCount: 0,
        serviceHistory: [],
        holdingStatus: item.holdingStatus || "ACTIVE",
        serviceNotes: item.serviceNotes?.trim() || undefined,
      });
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const issueNumber = `EMP-${dateStr}-${randomSuffix}`;

    const newIssue = await EmployeeIssue.create({
      issueNumber,
      employeeId: employee._id,
      employeeName: employee.name,
      employeeEmail: employee.email || "",
      employeePhone: employee.phone || "",
      employeeDepartment: employee.department || "",
      reason,
      items: issueItems,
      totalItems: issueItems.length,
      totalQuantity,
      totalValue,
      notes,
      issuedBy: currentUser._id,
      issuedByName: currentUser.name,
    });

    return Response.json(
      {
        success: true,
        message: "Employee issue saved and stock updated successfully",
        data: newIssue,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("POST /api/employee-issues error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to issue products to employee",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
