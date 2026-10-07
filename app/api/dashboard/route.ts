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
import Category from "@/models/Category";
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

export type ReusableAlert = {
  issueId: string;
  issueNumber: string;
  itemIndex: number;
  employeeName: string;
  employeePhone?: string;
  employeeDepartment?: string;
  productName: string;
  sku: string;
  serialNumber?: string;
  returnDueDays: number;
  returnDueDate: string;
  renewalCount: number;
  holdingStatus: string;
  isOverdue: boolean;
  daysRemaining: number;
};

export type StockAlert = {
  id: string;
  productId: string;
  warehouseId: string;
  rackId: string;
  productName: string;
  sku: string;
  warehouseName: string;
  rackName: string;
  quantity: number;
  status: "LOW_STOCK" | "OUT_OF_STOCK";
};

/**
 * Items whose recurring service cycle is due soon or already overdue.
 */
async function buildServiceAlerts(warehouseIds?: unknown[]): Promise<ServiceAlert[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {};
  if (warehouseIds && warehouseIds.length > 0) {
    filter["items.warehouseId"] = { $in: warehouseIds };
  }

  const issues = await EmployeeIssue.find(filter).sort({ createdAt: -1 }).limit(300);
  const alerts: ServiceAlert[] = [];

  for (const issue of issues) {
    issue.items.forEach((item, itemIndex) => {
      if (item.holdingStatus === "RETURNED") return;
      if (warehouseIds && warehouseIds.length > 0 && !warehouseIds.includes(item.warehouseId?.toString())) return;

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

  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 30);
}

/**
 * Reusable items whose return/renewal period is ending soon or overdue.
 */
async function buildReusableAlerts(warehouseIds?: unknown[]): Promise<ReusableAlert[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {};
  if (warehouseIds && warehouseIds.length > 0) {
    filter["items.warehouseId"] = { $in: warehouseIds };
  }

  const issues = await EmployeeIssue.find(filter).sort({ createdAt: -1 }).limit(300);
  const alerts: ReusableAlert[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const issue of issues) {
    issue.items.forEach((item, itemIndex) => {
      if (item.holdingStatus === "RETURNED") return;
      if (warehouseIds && warehouseIds.length > 0 && !warehouseIds.includes(item.warehouseId?.toString())) return;

      const isReusable =
        item.productType === "REUSABLE" ||
        Boolean(item.returnDueDate) ||
        Number(item.returnDueDays) > 0;
      if (!isReusable) return;

      let dueDate: Date;
      if (item.returnDueDate) {
        dueDate = new Date(item.returnDueDate);
      } else {
        const days = Number(item.returnDueDays) || 30;
        const createdTime = issue.createdAt ? new Date(issue.createdAt).getTime() : Date.now();
        dueDate = new Date(createdTime + days * 86400000);
      }
      dueDate.setHours(0, 0, 0, 0);

      const daysRemaining = Math.round((dueDate.getTime() - now.getTime()) / 86400000);

      // Alert if due within 7 days or already overdue
      if (daysRemaining > 7) return;

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
        returnDueDays: item.returnDueDays || 30,
        returnDueDate: dueDate.toISOString(),
        renewalCount: item.renewalCount || 0,
        holdingStatus: item.holdingStatus || "ACTIVE",
        isOverdue: daysRemaining < 0,
        daysRemaining,
      });
    });
  }

  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 30);
}

/**
 * Items that are Low in Stock or Out of Stock.
 */
async function buildStockAlerts(warehouseIds?: unknown[]): Promise<StockAlert[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {
    status: { $in: ["LOW_STOCK", "OUT_OF_STOCK"] },
  };
  if (warehouseIds && warehouseIds.length > 0) {
    filter.warehouseId = { $in: warehouseIds };
  }

  const items = await Inventory.find(filter)
    .populate("productId", "name sku")
    .populate("warehouseId", "name code")
    .populate("rackId", "name code")
    .sort({ quantity: 1 })
    .limit(30);

  return items.map((item) => {
    const pId =
      typeof item.productId === "object" && item.productId && "_id" in item.productId
        ? String((item.productId as { _id: unknown })._id)
        : String(item.productId);
    const wId =
      typeof item.warehouseId === "object" && item.warehouseId && "_id" in item.warehouseId
        ? String((item.warehouseId as { _id: unknown })._id)
        : String(item.warehouseId);
    const rId =
      typeof item.rackId === "object" && item.rackId && "_id" in item.rackId
        ? String((item.rackId as { _id: unknown })._id)
        : String(item.rackId);

    return {
      id: item._id.toString(),
      productId: pId,
      warehouseId: wId,
      rackId: rId,
      productName:
        typeof item.productId === "object" && item.productId && "name" in item.productId
          ? String((item.productId as { name: unknown }).name)
          : "Unknown Product",
      sku:
        typeof item.productId === "object" && item.productId && "sku" in item.productId
          ? String((item.productId as { sku: unknown }).sku)
          : "-",
      warehouseName:
        typeof item.warehouseId === "object" && item.warehouseId && "name" in item.warehouseId
          ? String((item.warehouseId as { name: unknown }).name)
          : "-",
      rackName:
        typeof item.rackId === "object" && item.rackId && "name" in item.rackId
          ? String((item.rackId as { name: unknown }).name)
          : "-",
      quantity: item.quantity,
      status: item.status as "LOW_STOCK" | "OUT_OF_STOCK",
    };
  });
}

export async function GET() {
  try {
    await connectDB();

    void Product;
    void Warehouse;
    void Rack;
    void Category;
    void Inventory;
    void EmployeeIssue;
    void User;

    const user = await requireSessionUser();

    if (user.role === "ADMIN") {
      const [
        warehouseCount,
        categoryCount,
        rackCount,
        productCount,
        inventoryItems,
        lowStockCount,
        outOfStockCount,
        staffCount,
        serviceAlerts,
        reusableAlerts,
        stockAlerts,
      ] = await Promise.all([
        Warehouse.countDocuments(),
        Category.countDocuments(),
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
          status: "LOW_STOCK",
        }),
        Inventory.countDocuments({
          status: "OUT_OF_STOCK",
        }),
        User.countDocuments({ role: "STAFF" }),
        buildServiceAlerts(),
        buildReusableAlerts(),
        buildStockAlerts(),
      ]);

      return Response.json({
        success: true,
        role: "ADMIN",
        data: {
          user: toSafeUser(user),
          metrics: [
            { label: "Staff", value: staffCount },
            { label: "Warehouses", value: warehouseCount },
            { label: "Racks", value: rackCount },
            { label: "Categories", value: categoryCount },
            { label: "Products", value: productCount },
            {
              label: "Total Stock",
              value: inventoryItems[0]?.totalQuantity ?? 0,
            },
            { label: "Low", value: lowStockCount },
            { label: "Out", value: outOfStockCount },
          ],
          serviceAlerts,
          reusableAlerts,
          stockAlerts,
          totalAlertCount:
            serviceAlerts.length + reusableAlerts.length + stockAlerts.length,
        },
      });
    }

    const warehouseIds = getUserWarehouseId(user);
    const warehouse = getUserWarehouse(user);

    if (!warehouseIds || warehouseIds.length === 0) {
      return Response.json(
        {
          success: false,
          message: "Staff user has no warehouse assignment",
        },
        { status: 400 }
      );
    }

    const [
      inventoryItems,
      lowStockCount,
      outOfStockCount,
      lowStockItems,
      distinctProducts,
      serviceAlerts,
      reusableAlerts,
      stockAlerts,
    ] = await Promise.all([
      Inventory.aggregate([
        {
          $match: {
            warehouseId: { $in: warehouseIds },
          },
        },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: "$quantity" },
          },
        },
      ]),
      Inventory.countDocuments({
        warehouseId: { $in: warehouseIds },
        status: "LOW_STOCK",
      }),
      Inventory.countDocuments({
        warehouseId: { $in: warehouseIds },
        status: "OUT_OF_STOCK",
      }),
      Inventory.find({
        warehouseId: { $in: warehouseIds },
        status: { $in: ["LOW_STOCK", "OUT_OF_STOCK"] },
      })
        .populate("productId", "name sku")
        .populate("rackId", "name code")
        .sort({ quantity: 1 })
        .limit(5),
      Inventory.distinct("productId", { warehouseId: { $in: warehouseIds } }),
      buildServiceAlerts(warehouseIds),
      buildReusableAlerts(warehouseIds),
      buildStockAlerts(warehouseIds),
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
          { label: "Low Stock", value: lowStockCount },
          { label: "Out of Stock", value: outOfStockCount },
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
          rackId:
            typeof item.rackId === "object" && item.rackId && "_id" in item.rackId
              ? String((item.rackId as { _id: unknown })._id)
              : String(item.rackId),
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
        reusableAlerts,
        stockAlerts,
        totalAlertCount: reusableAlerts.length + stockAlerts.length,
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
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
