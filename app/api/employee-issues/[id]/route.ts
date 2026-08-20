import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import EmployeeIssue from "@/models/EmployeeIssue";
import Inventory from "@/models/Inventory";
import Product from "@/models/Product";
import Warehouse from "@/models/Warehouse";
import Rack from "@/models/Rack";
import {
  HOLDING_STATUSES,
  MAX_INTERVAL_MONTHS,
  type HoldingStatus,
} from "@/lib/serviceCycle";

function getNextStatus(quantity: number) {
  if (quantity === 0) return "OUT_OF_STOCK";
  if (quantity <= 10) return "LOW_STOCK";
  return "AVAILABLE";
}

type RestorableItem = {
  inventoryId?: Types.ObjectId | string | null;
  productId?: Types.ObjectId | string | null;
  warehouseId?: Types.ObjectId | string | null;
  rackId?: Types.ObjectId | string | null;
  quantity: number;
};

/** Puts the held quantity back into warehouse stock when an item is returned. */
async function restoreStock(item: RestorableItem) {
  if (item.inventoryId) {
    const inventory = await Inventory.findById(item.inventoryId);
    if (inventory) {
      inventory.quantity = (inventory.quantity || 0) + item.quantity;
      inventory.status = getNextStatus(inventory.quantity);
      await inventory.save();
      return;
    }
  }

  if (!item.productId || !item.warehouseId || !item.rackId) return;

  const fallbackInventory = await Inventory.findOne({
    productId: item.productId,
    warehouseId: item.warehouseId,
    rackId: item.rackId,
  });

  if (fallbackInventory) {
    fallbackInventory.quantity = (fallbackInventory.quantity || 0) + item.quantity;
    fallbackInventory.status = getNextStatus(fallbackInventory.quantity);
    await fallbackInventory.save();
    return;
  }

  await Inventory.create({
    productId: item.productId,
    warehouseId: item.warehouseId,
    rackId: item.rackId,
    quantity: item.quantity,
    status: getNextStatus(item.quantity),
  });
}

function isHoldingStatus(value: unknown): value is HoldingStatus {
  return typeof value === "string" && HOLDING_STATUSES.includes(value as HoldingStatus);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    await requireSessionUser();
    const { id } = await params;

    const issue = await EmployeeIssue.findById(id);
    if (!issue) {
      return Response.json({ success: false, message: "Issue record not found" }, { status: 404 });
    }

    return Response.json({ success: true, data: issue });
  } catch (error) {
    console.error("GET /api/employee-issues/[id] error:", error);
    return Response.json({ success: false, message: "Failed to fetch issue" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const currentUser = await requireSessionUser();
    const { id } = await params;

    void Product;
    void Warehouse;
    void Rack;
    void Inventory;

    const issue = await EmployeeIssue.findById(id);
    if (!issue) {
      return Response.json({ success: false, message: "Issue record not found" }, { status: 404 });
    }

    const body = await request.json();
    const itemIndex = Number(body.itemIndex ?? 0);
    const action: string | undefined = body.action;

    if (!Number.isInteger(itemIndex) || !issue.items[itemIndex]) {
      return Response.json({ success: false, message: "Invalid item index" }, { status: 400 });
    }

    // Mutating the sub-document and calling save() persists reliably, unlike a
    // positional `$set` update which can silently drop nested array paths.
    const item = issue.items[itemIndex];
    const previousStatus: HoldingStatus = (item.holdingStatus || "ACTIVE") as HoldingStatus;

    const requestedStatus: HoldingStatus | null =
      action === "RETURN" ? "RETURNED" : isHoldingStatus(body.holdingStatus) ? body.holdingStatus : null;

    if (body.holdingStatus !== undefined && requestedStatus === null && action !== "RETURN") {
      return Response.json(
        { success: false, message: "Invalid holding status value" },
        { status: 400 }
      );
    }

    if (
      requestedStatus &&
      previousStatus === "RETURNED" &&
      requestedStatus !== "RETURNED"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "This item is already returned and its stock is back in the warehouse. Create a fresh issue to hand it out again.",
        },
        { status: 400 }
      );
    }

    const completeService = action === "COMPLETE_SERVICE" || body.markServiceCompleted === true;
    const trimmedNotes =
      typeof body.serviceNotes === "string" ? body.serviceNotes.trim() : undefined;

    const changes: string[] = [];

    // 1. Service interval (recurring cycle)
    if (body.serviceIntervalMonths !== undefined) {
      const interval = Number(body.serviceIntervalMonths);
      if (!Number.isFinite(interval) || interval < 0 || interval > MAX_INTERVAL_MONTHS) {
        return Response.json(
          {
            success: false,
            message: `Service interval must be between 0 and ${MAX_INTERVAL_MONTHS} months`,
          },
          { status: 400 }
        );
      }

      const normalized = Math.round(interval);
      if ((item.serviceIntervalMonths || 0) !== normalized) {
        changes.push(
          normalized === 0
            ? "periodic service disabled"
            : `service interval set to every ${normalized} month(s)`
        );
      }
      item.serviceIntervalMonths = normalized;
    }

    // 2. Holding status (+ stock restore when returned)
    if (requestedStatus && requestedStatus !== previousStatus) {
      item.holdingStatus = requestedStatus;
      changes.push(`status changed to ${requestedStatus}`);

      if (requestedStatus === "RETURNED") {
        await restoreStock(item);
        item.returnedAt = new Date();
      }
    }

    // 3. Service completion for the current cycle
    if (completeService) {
      const historyLength = item.serviceHistory?.length || 0;
      const nextServiceNumber = Math.max(historyLength, item.serviceCount || 0) + 1;
      const completedAt = new Date();

      item.serviceHistory = [
        ...(item.serviceHistory || []),
        {
          serviceNumber: nextServiceNumber,
          completedAt,
          notes: trimmedNotes || "Periodic service completed",
          performedBy: currentUser.name,
        },
      ];
      item.serviceCount = nextServiceNumber;
      item.lastServiceDate = completedAt;
      changes.push(`service #${nextServiceNumber} recorded`);
    }

    // 4. Renewal of reusable product period
    const isRenewAction = action === "RENEW_ITEM" || action === "RENEW";
    if (isRenewAction) {
      const extendDays = Math.max(1, Number(body.extendedDays) || Number(body.extendDays) || 30);
      const currentDue = item.returnDueDate ? new Date(item.returnDueDate) : new Date();
      const baseDate = currentDue.getTime() < Date.now() ? new Date() : currentDue;
      const newDueDate = new Date(baseDate.getTime() + extendDays * 86400000);
      const nextRenewalNum = (item.renewalCount || 0) + 1;
      const now = new Date();

      item.returnDueDate = newDueDate;
      item.returnDueDays = extendDays;
      item.lastRenewedDate = now;
      item.renewalCount = nextRenewalNum;
      item.holdingStatus = "ACTIVE";
      item.renewalHistory = [
        ...(item.renewalHistory || []),
        {
          renewalNumber: nextRenewalNum,
          renewedAt: now,
          extendedDays: extendDays,
          newDueDate,
          notes: trimmedNotes || `Renewed for ${extendDays} days`,
          performedBy: currentUser.name,
        },
      ];
      changes.push(
        `period renewed for +${extendDays} days (new due: ${newDueDate.toLocaleDateString("en-IN")})`
      );
    }

    // 5. Explicit returnDueDays update
    if (body.returnDueDays !== undefined && !isRenewAction) {
      const days = Number(body.returnDueDays);
      if (Number.isFinite(days) && days > 0) {
        item.returnDueDays = days;
        if (!item.returnDueDate) {
          item.returnDueDate = new Date(Date.now() + days * 86400000);
        }
        changes.push(`return period set to ${days} days`);
      }
    }

    // 6. Remarks
    if (trimmedNotes !== undefined) {
      item.serviceNotes = trimmedNotes;
    }

    if (changes.length === 0 && trimmedNotes === undefined) {
      return Response.json({
        success: true,
        message: "No changes to update",
        data: issue,
      });
    }

    issue.markModified("items");
    await issue.save();

    const updated = await EmployeeIssue.findById(id);

    return Response.json({
      success: true,
      message: changes.length > 0 ? `Updated: ${changes.join(", ")}` : "Remarks updated",
      data: updated,
      itemIndex,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("PUT /api/employee-issues/[id] error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to update employee issue",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    await requireSessionUser();
    const { id } = await params;

    void Product;
    void Warehouse;
    void Rack;
    void Inventory;

    const issue = await EmployeeIssue.findById(id);
    if (!issue) {
      return Response.json({ success: false, message: "Issue record not found" }, { status: 404 });
    }

    // Restore inventory if items were not returned
    for (const item of issue.items) {
      if (item.holdingStatus !== "RETURNED") {
        await restoreStock(item);
      }
    }

    await EmployeeIssue.findByIdAndDelete(id);

    return Response.json({ success: true, message: "Issue record deleted and inventory restored" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    console.error("DELETE /api/employee-issues/[id] error:", error);
    return Response.json({ success: false, message: "Failed to delete issue" }, { status: 500 });
  }
}
