import { connectDB } from "@/lib/mongodb";
import { getUserWarehouseId, requireSessionUser } from "@/lib/auth";
import StockMovement, { MovementReason, MovementType } from "@/models/StockMovement";
import Product from "@/models/Product";
import Warehouse from "@/models/Warehouse";
import Rack from "@/models/Rack";
import EmployeeIssue from "@/models/EmployeeIssue";
import Invoice from "@/models/Invoice";
import Inventory from "@/models/Inventory";

function getPeriodDateRange(period?: string | null, startDate?: string | null, endDate?: string | null, singleDate?: string | null) {
  const now = new Date();

  if (singleDate) {
    const start = new Date(`${singleDate}T00:00:00.000Z`);
    const end = new Date(`${singleDate}T23:59:59.999Z`);
    return { start, end };
  }

  if (startDate || endDate) {
    const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : new Date("2020-01-01T00:00:00.000Z");
    const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : new Date();
    return { start, end };
  }

  switch (period) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    case "this_week": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      return { start, end };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end };
    }
    default:
      return null;
  }
}

/**
 * Historical synchronizer:
 * Backfills past EmployeeIssues, Invoices, and Inventory into StockMovements if needed.
 */
async function backfillHistoricalMovementsIfNeeded() {
  try {
    const movementCount = await StockMovement.countDocuments();
    if (movementCount > 0) return; // Already initialized

    const [issues, invoices, inventories] = await Promise.all([
      EmployeeIssue.find().lean(),
      Invoice.find().lean(),
      Inventory.find().populate("productId", "name sku price category").populate("warehouseId", "name code").populate("rackId", "name code").lean(),
    ]);

    const movementsToInsert: unknown[] = [];

    // 1. Initial inventory entries (INWARD)
    for (const inv of inventories) {
      if (!inv.productId) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prod = inv.productId as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wh = inv.warehouseId as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rk = inv.rackId as any;

      movementsToInsert.push({
        productId: prod._id,
        productName: prod.name || "Product",
        sku: prod.sku || "-",
        category: prod.category,
        warehouseId: wh?._id,
        warehouseName: wh?.name,
        rackId: rk?._id,
        rackName: rk?.name,
        movementType: "INWARD",
        reason: "INITIAL_STOCK",
        quantity: inv.quantity || 1,
        unitPrice: prod.price || 0,
        totalValue: (prod.price || 0) * (inv.quantity || 1),
        referenceNumber: "INITIAL-STOCK",
        entityName: "Warehouse Stock Addition",
        notes: "Initial inventory setup",
        createdAt: inv.createdAt || new Date(),
      });
    }

    // 2. Employee Issues (OUTWARD & RETURNS)
    for (const issue of issues) {
      for (const item of issue.items || []) {
        movementsToInsert.push({
          productId: item.inventoryId ? undefined : undefined,
          productName: item.productName,
          sku: item.sku,
          warehouseName: item.warehouseName,
          rackName: item.rackName,
          movementType: "OUTWARD",
          reason: "EMPLOYEE_ISSUE",
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          totalValue: item.totalValue || (item.unitPrice || 0) * (item.quantity || 1),
          serialNumber: item.serialNumber,
          referenceId: issue._id.toString(),
          referenceNumber: `ISSUE #${issue.issueNumber}`,
          entityName: `${issue.employeeName}${issue.employeeDepartment ? ` (${issue.employeeDepartment})` : ""}`,
          entityId: issue.employeeId,
          notes: issue.notes || `Issued for ${issue.reason}`,
          createdAt: issue.createdAt || new Date(),
        });

        if (item.holdingStatus === "RETURNED") {
          movementsToInsert.push({
            productName: item.productName,
            sku: item.sku,
            warehouseName: item.warehouseName,
            rackName: item.rackName,
            movementType: "INWARD",
            reason: "EMPLOYEE_RETURN",
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0,
            totalValue: item.totalValue || (item.unitPrice || 0) * (item.quantity || 1),
            serialNumber: item.serialNumber,
            referenceId: issue._id.toString(),
            referenceNumber: `RETURN #${issue.issueNumber}`,
            entityName: `${issue.employeeName} (Returned)`,
            entityId: issue.employeeId,
            notes: item.serviceNotes || "Returned to warehouse stock",
            createdAt: item.returnedAt ? new Date(item.returnedAt) : issue.updatedAt || new Date(),
          });
        }
      }
    }

    // 3. Billing Invoices (OUTWARD)
    for (const inv of invoices) {
      for (const item of inv.items || []) {
        movementsToInsert.push({
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          warehouseId: item.warehouseId,
          warehouseName: item.warehouseName,
          rackId: item.rackId,
          rackName: item.rackName,
          movementType: "OUTWARD",
          reason: "INVOICE_SALE",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalValue: item.total,
          referenceId: inv._id.toString(),
          referenceNumber: `INVOICE #${inv.invoiceNumber}`,
          entityName: inv.customerName,
          notes: inv.notes || `Sold via ${inv.paymentMethod}`,
          createdAt: inv.createdAt || new Date(),
        });
      }
    }

    if (movementsToInsert.length > 0) {
      // Find matching product IDs where missing
      const allProducts = await Product.find().select("_id name sku category").lean();
      const prodMap = new Map(allProducts.map((p) => [p.sku.toLowerCase(), p]));

      for (const m of movementsToInsert as Record<string, unknown>[]) {
        if (!m.productId && m.sku) {
          const matched = prodMap.get(String(m.sku).toLowerCase());
          if (matched) {
            m.productId = matched._id;
            m.category = matched.category;
          }
        }
      }

      // Filter out entries without productId
      const validToInsert = (movementsToInsert as Record<string, unknown>[]).filter((m) => m.productId);
      if (validToInsert.length > 0) {
        await StockMovement.insertMany(validToInsert);
      }
    }
  } catch (err) {
    console.error("Failed to backfill historical movements:", err);
  }
}

export async function GET(request: Request) {
  try {
    await connectDB();
    const user = await requireSessionUser();

    void Product;
    void Warehouse;
    void Rack;

    await backfillHistoricalMovementsIfNeeded();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "this_month";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const singleDate = searchParams.get("singleDate");
    const typeParam = searchParams.get("type"); // INWARD | OUTWARD | ALL
    const reasonParam = searchParams.get("reason");
    const warehouseParam = searchParams.get("warehouseId");
    const queryParam = searchParams.get("q") || searchParams.get("search");

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    // Staff warehouse restriction
    const staffWarehouseId = getUserWarehouseId(user);
    if (user.role === "STAFF" && staffWarehouseId) {
      filter.warehouseId = staffWarehouseId;
    } else if (warehouseParam && warehouseParam !== "ALL") {
      filter.warehouseId = warehouseParam;
    }

    // Date range filter
    const range = getPeriodDateRange(period, startDate, endDate, singleDate);
    if (range) {
      filter.createdAt = {
        $gte: range.start,
        $lte: range.end,
      };
    }

    // Movement type filter
    if (typeParam && typeParam !== "ALL") {
      filter.movementType = typeParam;
    }

    // Reason filter
    if (reasonParam && reasonParam !== "ALL") {
      filter.reason = reasonParam;
    }

    // Search query
    if (queryParam?.trim()) {
      const regex = new RegExp(queryParam.trim(), "i");
      filter.$or = [
        { productName: regex },
        { sku: regex },
        { serialNumber: regex },
        { entityName: regex },
        { referenceNumber: regex },
        { warehouseName: regex },
        { rackName: regex },
      ];
    }

    const page = Math.max(1, parseInt(pageParam || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(limitParam || "15", 10)));
    const skip = (page - 1) * limit;

    // Fetch movements and summary KPIs
    const [total, movements, allFilteredForKpi] = await Promise.all([
      StockMovement.countDocuments(filter),
      StockMovement.find(filter)
        .populate("productId", "name sku category sellerName price")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockMovement.find(filter).select("movementType quantity totalValue unitPrice").lean(),
    ]);

    let totalInwardUnits = 0;
    let totalInwardValue = 0;
    let totalOutwardUnits = 0;
    let totalOutwardValue = 0;

    for (const m of allFilteredForKpi) {
      const qty = m.quantity || 1;
      const val = m.totalValue || (m.unitPrice || 0) * qty;
      if (m.movementType === "INWARD") {
        totalInwardUnits += qty;
        totalInwardValue += val;
      } else if (m.movementType === "OUTWARD") {
        totalOutwardUnits += qty;
        totalOutwardValue += val;
      }
    }

    const netFlowUnits = totalInwardUnits - totalOutwardUnits;
    const netFlowValue = totalInwardValue - totalOutwardValue;

    return Response.json({
      success: true,
      data: movements,
      metrics: {
        totalInwardUnits,
        totalInwardValue,
        totalOutwardUnits,
        totalOutwardValue,
        netFlowUnits,
        netFlowValue,
        totalRecords: total,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }
    console.error("GET /api/movements error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to fetch stock movements",
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
      return Response.json({ success: false, message: "Only admin can log stock movements" }, { status: 403 });
    }

    const body = await request.json();
    const {
      productId,
      productName,
      sku,
      warehouseId,
      warehouseName,
      rackId,
      rackName,
      movementType,
      reason,
      quantity,
      unitPrice,
      serialNumber,
      referenceNumber,
      entityName,
      notes,
    } = body;

    if (!productId || !movementType || !reason || !quantity) {
      return Response.json({ success: false, message: "Missing required movement fields" }, { status: 400 });
    }

    const numQty = Number(quantity);
    const numPrice = Number(unitPrice) || 0;

    const movement = await StockMovement.create({
      productId,
      productName,
      sku,
      warehouseId,
      warehouseName,
      rackId,
      rackName,
      movementType,
      reason,
      quantity: numQty,
      unitPrice: numPrice,
      totalValue: numQty * numPrice,
      serialNumber: serialNumber?.trim() || undefined,
      referenceNumber: referenceNumber?.trim() || undefined,
      entityName: entityName?.trim() || undefined,
      notes: notes?.trim() || undefined,
      performedBy: user.id,
      performedByName: user.name,
    });

    return Response.json({ success: true, data: movement }, { status: 201 });
  } catch (error) {
    console.error("POST /api/movements error:", error);
    return Response.json(
      { success: false, message: "Failed to create movement log" },
      { status: 500 }
    );
  }
}
