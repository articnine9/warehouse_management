import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Product from "@/models/Product";
import Inventory from "@/models/Inventory";
import EmployeeIssue from "@/models/EmployeeIssue";
import StockMovement from "@/models/StockMovement";
import ProductHistory from "@/models/ProductHistory";
import Warehouse from "@/models/Warehouse";
import Rack from "@/models/Rack";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    await requireSessionUser();

    // Ensure models are registered for populate
    void Warehouse;
    void Rack;

    const { id: productId } = await params;

    if (!productId) {
      return Response.json(
        { success: false, message: "Product ID is required" },
        { status: 400 }
      );
    }

    const decodedId = decodeURIComponent(productId).trim();

    let product = null;
    try {
      if (/^[0-9a-fA-F]{24}$/.test(decodedId)) {
        product = await Product.findById(decodedId).lean();
      }
    } catch {
      product = null;
    }

    if (!product) {
      product = await Product.findOne({
        $or: [
          { sku: { $regex: new RegExp(`^${decodedId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
          { name: { $regex: new RegExp(`^${decodedId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
        ],
      }).lean();
    }

    if (!product) {
      return Response.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    const effectiveProductId = product._id;

    // Concurrently fetch current stock, issues, movements, and change logs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [inventoryItems, issues, movements, changeLogs] = await Promise.all([
      Inventory.find({ productId: effectiveProductId })
        .populate("warehouseId", "name code address")
        .populate("rackId", "name code")
        .sort({ quantity: -1 })
        .lean() as Promise<any[]>,
      EmployeeIssue.find({
        $or: [
          { "items.productId": effectiveProductId },
          { "items.sku": product.sku },
        ],
      })
        .sort({ createdAt: -1 })
        .lean() as Promise<any[]>,
      StockMovement.find({
        $or: [{ productId: effectiveProductId }, { sku: product.sku }],
      })
        .populate("performedBy", "name email")
        .sort({ createdAt: -1 })
        .limit(200)
        .lean() as Promise<any[]>,
      ProductHistory.find({ productId: effectiveProductId })
        .populate("changedBy", "name email")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean() as Promise<any[]>,
    ]);

    const totalInStock = inventoryItems.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );

    const employeeHolders: Array<{
      issueId: string;
      issueNumber: string;
      issueDate: string;
      employeeId?: string;
      employeeName: string;
      employeeDepartment?: string;
      employeePhone?: string;
      employeeEmail?: string;
      quantity: number;
      unitPrice: number;
      totalValue: number;
      serialNumber?: string;
      warehouseName: string;
      rackName: string;
      holdingStatus: string;
      returnDueDate?: string;
      lastServiceDate?: string;
      serviceCount?: number;
      returnedAt?: string;
      serviceNotes?: string;
    }> = [];

    let totalUnitsActiveIssued = 0;
    let totalUnitsReturned = 0;

    for (const issue of issues) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      issue.items.forEach((item: any) => {
        if (item.productId?.toString() === productId.toString() || item.sku === product.sku) {
          const isReturned = item.holdingStatus === "RETURNED";
          if (isReturned) {
            totalUnitsReturned += item.quantity || 1;
          } else {
            totalUnitsActiveIssued += item.quantity || 1;
          }

          employeeHolders.push({
            issueId: issue._id.toString(),
            issueNumber: issue.issueNumber,
            issueDate: new Date(issue.createdAt).toISOString(),
            employeeId: issue.employeeId?.toString(),
            employeeName: issue.employeeName,
            employeeDepartment: issue.employeeDepartment,
            employeePhone: issue.employeePhone,
            employeeEmail: issue.employeeEmail,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalValue: item.totalValue,
            serialNumber: item.serialNumber,
            warehouseName: item.warehouseName,
            rackName: item.rackName,
            holdingStatus: item.holdingStatus || "ACTIVE",
            returnDueDate: item.returnDueDate
              ? new Date(item.returnDueDate).toISOString()
              : undefined,
            lastServiceDate: item.lastServiceDate
              ? new Date(item.lastServiceDate).toISOString()
              : undefined,
            serviceCount: item.serviceCount || 0,
            returnedAt: item.returnedAt
              ? new Date(item.returnedAt).toISOString()
              : undefined,
            serviceNotes: item.serviceNotes,
          });
        }
      });
    }

    // 5. Build Unified Chronological Lifecycle Events (From Inward to Today)
    type LifecycleEvent = {
      id: string;
      date: string;
      eventType: "INWARD" | "OUTWARD" | "EMPLOYEE_ISSUE" | "EMPLOYEE_RETURN" | "SERVICE" | "INVOICE_SALE";
      title: string;
      subtitle?: string;
      quantity: number;
      entityName?: string;
      location?: string;
      notes?: string;
      badgeColor?: string;
    };

    const lifecycleEvents: LifecycleEvent[] = [];

    // Add Inward movements (Arrivals / Restocks)
    movements.forEach((m) => {
      if (m.movementType === "INWARD") {
        lifecycleEvents.push({
          id: `mov-${m._id}`,
          date: new Date(m.createdAt).toISOString(),
          eventType: "INWARD",
          title: m.reason === "INITIAL_STOCK" ? "Initial Stock Inward" : "Stock Restocked / Added",
          subtitle: m.referenceNumber ? `Ref: ${m.referenceNumber}` : undefined,
          quantity: m.quantity,
          entityName: m.entityName || product.sellerName || "Supplier",
          location: `${m.warehouseName || "Warehouse"} • ${m.rackName || "Rack"}`,
          notes: m.notes,
          badgeColor: "emerald",
        });
      } else if (m.reason === "INVOICE_SALE") {
        lifecycleEvents.push({
          id: `mov-${m._id}`,
          date: new Date(m.createdAt).toISOString(),
          eventType: "INVOICE_SALE",
          title: "Sold via Customer Invoice",
          subtitle: m.referenceNumber ? `Inv #${m.referenceNumber}` : undefined,
          quantity: m.quantity,
          entityName: m.entityName || "Customer",
          location: m.warehouseName,
          notes: m.notes,
          badgeColor: "blue",
        });
      }
    });

    // Add Employee Issues & Returns
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    issues.forEach((iss: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iss.items.forEach((item: any, itemIdx: number) => {
        if (item.productId?.toString() === effectiveProductId.toString() || item.sku === product.sku) {
          // Issue event
          lifecycleEvents.push({
            id: `iss-${iss._id}-${itemIdx}`,
            date: new Date(iss.createdAt).toISOString(),
            eventType: "EMPLOYEE_ISSUE",
            title: `Issued to Employee: ${iss.employeeName}`,
            subtitle: `Voucher #${iss.issueNumber} • Dept: ${iss.employeeDepartment || "General"}`,
            quantity: item.quantity,
            entityName: iss.employeeName,
            location: `${item.warehouseName} • ${item.rackName}`,
            notes: item.serialNumber ? `Serial: ${item.serialNumber}` : iss.notes,
            badgeColor: "indigo",
          });

          // If returned, add Return event
          if (item.holdingStatus === "RETURNED") {
            const retDate = item.returnedAt ? new Date(item.returnedAt).toISOString() : new Date(iss.updatedAt).toISOString();
            lifecycleEvents.push({
              id: `ret-${iss._id}-${itemIdx}`,
              date: retDate,
              eventType: "EMPLOYEE_RETURN",
              title: `Returned to Warehouse by ${iss.employeeName}`,
              subtitle: `Returned from Voucher #${iss.issueNumber}`,
              quantity: item.quantity,
              entityName: iss.employeeName,
              location: `${item.warehouseName} • ${item.rackName}`,
              notes: item.serviceNotes || "Returned to stock",
              badgeColor: "cyan",
            });
          }

          // Any services
          if (item.serviceHistory && item.serviceHistory.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            item.serviceHistory.forEach((s: any, sIdx: number) => {
              lifecycleEvents.push({
                id: `srv-${iss._id}-${itemIdx}-${sIdx}`,
                date: new Date(s.completedAt).toISOString(),
                eventType: "SERVICE",
                title: `Service Maintenance #${s.serviceNumber}`,
                subtitle: `Holder: ${iss.employeeName}`,
                quantity: item.quantity,
                entityName: s.performedBy || "Service Tech",
                notes: s.notes,
                badgeColor: "amber",
              });
            });
          }
        }
      });
    });

    // Sort timeline descending (most recent first)
    lifecycleEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return Response.json({
      success: true,
      data: {
        product: {
          id: product._id.toString(),
          name: product.name,
          sku: product.sku,
          category: product.category,
          price: product.price,
          description: product.description,
          productType: product.productType || "NON_REUSABLE",
          returnDays: product.returnDays || 30,
          warrantyMonths: product.warrantyMonths || 0,
          serviceIntervalMonths: product.serviceIntervalMonths || 0,
          sellerName: product.sellerName,
          createdAt: product.createdAt,
        },
        summary: {
          totalInStock,
          totalUnitsActiveIssued,
          totalUnitsReturned,
          totalMovementRecords: movements.length,
          totalHolders: employeeHolders.length,
          activeHoldersCount: employeeHolders.filter((h) => h.holdingStatus !== "RETURNED").length,
        },
        inventoryLocations: inventoryItems.map((inv) => ({
          id: inv._id.toString(),
          warehouse: inv.warehouseId,
          rack: inv.rackId,
          quantity: inv.quantity,
          status: inv.status,
          updatedAt: inv.updatedAt,
        })),
        employeeHolders,
        lifecycleEvents,
        movements: movements.map((m) => ({
          id: m._id.toString(),
          movementType: m.movementType,
          reason: m.reason,
          quantity: m.quantity,
          unitPrice: m.unitPrice,
          totalValue: m.totalValue,
          warehouseName: m.warehouseName,
          rackName: m.rackName,
          serialNumber: m.serialNumber,
          referenceNumber: m.referenceNumber,
          entityName: m.entityName,
          notes: m.notes,
          performedByName: m.performedByName,
          createdAt: m.createdAt,
        })),
        changeLogs,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }
    console.error("GET /api/history/product/[id] error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to fetch product history",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
