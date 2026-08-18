import { connectDB } from "@/lib/mongodb";
import {
  getUserWarehouse,
  getUserWarehouseId,
  requireSessionUser,
  toSafeUser,
} from "@/lib/auth";
import EmployeeIssue from "@/models/EmployeeIssue";
import Inventory from "@/models/Inventory";
import Product from "@/models/Product";
import Rack from "@/models/Rack";
import User from "@/models/User";
import Warehouse from "@/models/Warehouse";
import { getServiceCycleInfo } from "@/lib/serviceCycle";

type ServiceAlert = {
  issueId: string;
  issueNumber: string;
  itemIndex: number;
  employeeName: string;
  employeePhone?: string;
  employeeDepartment?: string;
  productName: string;
  sku: string;
  serialNumber?: string;
  serviceStage: string;
  serviceDate: string;
  holdingStatus: string;
  isOverdue: boolean;
  daysRemaining: number;
};

/**
 * Items whose recurring service cycle is due soon or already overdue.
 * Powers the notification bell.
 */
async function buildServiceAlerts(warehouseId?: unknown): Promise<ServiceAlert[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {};
  if (warehouseId) {
    filter["items.warehouseId"] = warehouseId;
  }

  const issues = await EmployeeIssue.find(filter).sort({ createdAt: -1 }).limit(300);
  const alerts: ServiceAlert[] = [];

  for (const issue of issues) {
    issue.items.forEach((item, itemIndex) => {
      if (item.holdingStatus === "RETURNED") return;
      if (warehouseId && item.warehouseId?.toString() !== warehouseId.toString()) return;

      const cycle = getServiceCycleInfo({
        intervalMonths: item.serviceIntervalMonths,
        lastServiceDate: item.lastServiceDate,
        issuedAt: issue.createdAt,
      });

      if (!cycle.nextServiceDate || cycle.daysRemaining === null) return;
      if (!cycle.isOverdue && !cycle.isDueSoon) return;

      alerts.push({
        issueId: issue._id.toString(),
        issueNumber: issue.issueNumber,
        itemIndex,
        employeeName: issue.employeeName,
        employeePhone: issue.employeePhone,
        employeeDepartment: issue.employeeDepartment,
        productName: item.productName,
        sku: item.sku,
        serialNumber: item.serialNumber,
        serviceStage: `Service #${(item.serviceCount || 0) + 1} • ${cycle.intervalLabel}`,
        serviceDate: cycle.nextServiceDate.toISOString(),
        holdingStatus: item.holdingStatus || "ACTIVE",
        isOverdue: cycle.isOverdue,
        daysRemaining: cycle.daysRemaining,
      });
    });
  }

  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 25);
}

export async function GET() {
  try {
    await connectDB();

    const user = await requireSessionUser();

    if (user.role === "ADMIN") {
      const [
        warehouseCount,
        rackCount,
        productCount,
        inventoryItems,
        lowStockCount,
        staffCount,
        serviceAlerts,
      ] = await Promise.all([
        Warehouse.countDocuments(),
        Rack.countDocuments(),
        Product.countDocuments(),
        Inventory.aggregate([
          {
            $group: {
              _id: null,
              totalQuantity: { $sum: "$quantity" },
            },
          },
        ]),
        Inventory.countDocuments({
          status: { $in: ["LOW_STOCK", "OUT_OF_STOCK"] },
        }),
        User.countDocuments({ role: "STAFF" }),
        buildServiceAlerts(),
      ]);

      return Response.json({
        success: true,
        role: "ADMIN",
        data: {
          user: toSafeUser(user),
          metrics: [
            { label: "Warehouses", value: warehouseCount },
            { label: "Racks", value: rackCount },
            { label: "Products", value: productCount },
            {
              label: "Total Stock",
              value: inventoryItems[0]?.totalQuantity ?? 0,
            },
            { label: "Staff", value: staffCount },
            { label: "Low / Out", value: lowStockCount },
          ],
          serviceAlerts,
        },
      });
    }

    const warehouseId = getUserWarehouseId(user);
    const warehouse = getUserWarehouse(user);

    if (!warehouseId) {
      return Response.json(
        {
          success: false,
          message: "Staff user has no warehouse assignment",
        },
        { status: 400 }
      );
    }

    const [inventoryItems, lowStockItems, distinctProducts, serviceAlerts] = await Promise.all([
      Inventory.aggregate([
        {
          $match: {
            warehouseId,
          },
        },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: "$quantity" },
          },
        },
      ]),
      Inventory.find({
        warehouseId,
        status: { $in: ["LOW_STOCK", "OUT_OF_STOCK"] },
      })
        .populate("productId", "name sku")
        .populate("rackId", "name code")
        .sort({ quantity: 1 })
        .limit(5),
      Inventory.distinct("productId", { warehouseId }),
      buildServiceAlerts(warehouseId),
    ]);

    return Response.json({
      success: true,
      role: "STAFF",
      data: {
        user: toSafeUser(user),
        metrics: [
          { label: "Assigned Warehouse", value: warehouse?.name || "-" },
          { label: "Products in Warehouse", value: distinctProducts.length },
          { label: "Total Units", value: inventoryItems[0]?.totalQuantity ?? 0 },
          { label: "Attention Needed", value: lowStockItems.length },
        ],
        lowStockItems: lowStockItems.map((item) => ({
          id: item._id.toString(),
          productName:
            typeof item.productId === "object" && item.productId
              ? "name" in item.productId
                ? item.productId.name
                : "Unknown Product"
              : "Unknown Product",
          sku:
            typeof item.productId === "object" && item.productId && "sku" in item.productId
              ? item.productId.sku
              : "-",
          rackName:
            typeof item.rackId === "object" && item.rackId && "name" in item.rackId
              ? item.rackId.name
              : "-",
          rackCode:
            typeof item.rackId === "object" && item.rackId && "code" in item.rackId
              ? item.rackId.code
              : "-",
          quantity: item.quantity,
          status: item.status,
        })),
        serviceAlerts,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        {
          success: false,
          message: "Not authenticated",
        },
        { status: 401 }
      );
    }

    console.error("GET /api/dashboard error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to fetch dashboard summary",
      },
      { status: 500 }
    );
  }
}
