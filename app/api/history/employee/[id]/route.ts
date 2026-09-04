import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Employee from "@/models/Employee";
import EmployeeIssue from "@/models/EmployeeIssue";
import Warehouse from "@/models/Warehouse";
import { getServiceCycleInfo } from "@/lib/serviceCycle";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    await requireSessionUser();

    void Warehouse;

    const { id } = await params;

    if (!id) {
      return Response.json(
        { success: false, message: "Employee ID is required" },
        { status: 400 }
      );
    }

    const decodedId = decodeURIComponent(id).trim();

    // Try finding by ObjectId or employeeCode / name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let employee: any = null;
    try {
      if (/^[0-9a-fA-F]{24}$/.test(decodedId)) {
        employee = await Employee.findById(decodedId).populate("warehouseId", "name code address").lean();
      }
    } catch {
      employee = null;
    }

    if (!employee) {
      employee = await Employee.findOne({
        $or: [
          { employeeCode: { $regex: new RegExp(`^${decodedId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
          { name: { $regex: new RegExp(`^${decodedId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
        ],
      }).populate("warehouseId", "name code address").lean();
    }

    // Find all issues matching employee ID or employee name
    const queryConditions: Array<Record<string, unknown>> = [];
    if (/^[0-9a-fA-F]{24}$/.test(decodedId)) {
      queryConditions.push({ employeeId: decodedId });
    }
    queryConditions.push({ employeeName: { $regex: new RegExp(`^${decodedId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } });

    if (employee) {
      queryConditions.push({ employeeId: employee._id });
      queryConditions.push({ employeeName: { $regex: new RegExp(`^${employee.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const issues = (await EmployeeIssue.find({
      $or: queryConditions,
    }).sort({ createdAt: -1 }).lean()) as any[];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const activeAssets: Array<{
      issueId: string;
      issueNumber: string;
      itemIndex: number;
      productId: string;
      productName: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      totalValue: number;
      serialNumber?: string;
      warehouseName: string;
      rackName: string;
      productType?: string;
      returnDueDays?: number;
      returnDueDate?: string;
      daysRemaining?: number;
      isOverdue?: boolean;
      serviceIntervalMonths?: number;
      lastServiceDate?: string;
      nextServiceDate?: string;
      serviceStage?: string;
      isServiceDue?: boolean;
      isServiceOverdue?: boolean;
      serviceCount?: number;
      holdingStatus: string;
      issuedAt: string;
    }> = [];

    const returnedAssets: Array<{
      issueId: string;
      issueNumber: string;
      itemIndex: number;
      productId: string;
      productName: string;
      sku: string;
      quantity: number;
      serialNumber?: string;
      warehouseName: string;
      rackName: string;
      issuedAt: string;
      returnedAt?: string;
      serviceCount?: number;
      totalValue: number;
    }> = [];

    const serviceHistory: Array<{
      issueId: string;
      issueNumber: string;
      productName: string;
      sku: string;
      serialNumber?: string;
      serviceNumber: number;
      completedAt: string;
      notes?: string;
      performedBy?: string;
    }> = [];

    let totalActiveValue = 0;
    let activeUnitsCount = 0;
    let returnedUnitsCount = 0;
    let overdueCount = 0;
    let upcomingServicesCount = 0;

    for (const issue of issues) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      issue.items.forEach((item: any, itemIndex: number) => {
        const isReturned = item.holdingStatus === "RETURNED";

        // Collect completed services
        if (item.serviceHistory && item.serviceHistory.length > 0) {
          for (const s of item.serviceHistory) {
            serviceHistory.push({
              issueId: issue._id.toString(),
              issueNumber: issue.issueNumber,
              productName: item.productName,
              sku: item.sku,
              serialNumber: item.serialNumber,
              serviceNumber: s.serviceNumber,
              completedAt: new Date(s.completedAt).toISOString(),
              notes: s.notes,
              performedBy: s.performedBy,
            });
          }
        }

        if (isReturned) {
          returnedUnitsCount += item.quantity || 1;
          returnedAssets.push({
            issueId: issue._id.toString(),
            issueNumber: issue.issueNumber,
            itemIndex,
            productId: item.productId?.toString(),
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            serialNumber: item.serialNumber,
            warehouseName: item.warehouseName,
            rackName: item.rackName,
            issuedAt: issue.createdAt.toISOString(),
            returnedAt: item.returnedAt
              ? new Date(item.returnedAt).toISOString()
              : undefined,
            serviceCount: item.serviceCount || 0,
            totalValue: item.totalValue || 0,
          });
        } else {
          activeUnitsCount += item.quantity || 1;
          totalActiveValue += item.totalValue || 0;

          // Calculate return due countdown
          let daysRemaining: number | undefined = undefined;
          let isOverdue = false;

          if (item.returnDueDate) {
            const dueDate = new Date(item.returnDueDate);
            dueDate.setHours(0, 0, 0, 0);
            daysRemaining = Math.round((dueDate.getTime() - now.getTime()) / 86400000);
            if (daysRemaining < 0) {
              isOverdue = true;
              overdueCount++;
            }
          }

          // Calculate service cycle
          const cycle = getServiceCycleInfo({
            intervalMonths: item.serviceIntervalMonths,
            lastServiceDate: item.lastServiceDate,
            issuedAt: issue.createdAt,
          });

          if (cycle.isDueSoon || cycle.isOverdue) {
            upcomingServicesCount++;
          }

          activeAssets.push({
            issueId: issue._id.toString(),
            issueNumber: issue.issueNumber,
            itemIndex,
            productId: item.productId?.toString(),
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalValue: item.totalValue,
            serialNumber: item.serialNumber,
            warehouseName: item.warehouseName,
            rackName: item.rackName,
            productType: item.productType,
            returnDueDays: item.returnDueDays,
            returnDueDate: item.returnDueDate
              ? new Date(item.returnDueDate).toISOString()
              : undefined,
            daysRemaining,
            isOverdue,
            serviceIntervalMonths: item.serviceIntervalMonths,
            lastServiceDate: item.lastServiceDate
              ? new Date(item.lastServiceDate).toISOString()
              : undefined,
            nextServiceDate: cycle.nextServiceDate
              ? cycle.nextServiceDate.toISOString()
              : undefined,
            serviceStage: cycle.intervalLabel,
            isServiceDue: cycle.isDueSoon,
            isServiceOverdue: cycle.isOverdue,
            serviceCount: item.serviceCount || 0,
            holdingStatus: item.holdingStatus || "ACTIVE",
            issuedAt: issue.createdAt.toISOString(),
          });
        }
      });
    }

    return Response.json({
      success: true,
      data: {
        employee: employee
          ? {
              id: employee._id.toString(),
              employeeCode: employee.employeeCode,
              name: employee.name,
              department: employee.department,
              designation: employee.designation,
              email: employee.email,
              phone: employee.phone,
              warehouse: employee.warehouseId,
              status: employee.status,
              joinedDate: employee.createdAt ? new Date(employee.createdAt).toISOString() : undefined,
              createdAt: employee.createdAt ? new Date(employee.createdAt).toISOString() : undefined,
            }
          : {
              id: decodedId,
              employeeCode: "-",
              name: issues[0]?.employeeName || decodedId || "Employee",
              department: issues[0]?.employeeDepartment || "-",
              designation: "-",
              email: issues[0]?.employeeEmail || "-",
              phone: issues[0]?.employeePhone || "-",
              warehouse: null,
              status: "ACTIVE",
              joinedDate: issues[issues.length - 1]?.createdAt
                ? new Date(issues[issues.length - 1].createdAt).toISOString()
                : undefined,
              createdAt: issues[issues.length - 1]?.createdAt
                ? new Date(issues[issues.length - 1].createdAt).toISOString()
                : undefined,
            },
        summary: {
          totalIssuesCount: issues.length,
          activeUnitsCount,
          returnedUnitsCount,
          totalActiveValue,
          overdueCount,
          upcomingServicesCount,
          servicesCompletedCount: serviceHistory.length,
        },
        activeAssets,
        returnedAssets,
        issueSlips: issues.map((iss) => ({
          id: iss._id.toString(),
          issueNumber: iss.issueNumber,
          date: iss.createdAt.toISOString(),
          reason: iss.reason,
          totalItems: iss.totalItems,
          totalQuantity: iss.totalQuantity,
          totalValue: iss.totalValue,
          notes: iss.notes,
          issuedByName: iss.issuedByName,
        })),
        serviceHistory,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }
    console.error("GET /api/history/employee/[id] error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to fetch employee history",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
