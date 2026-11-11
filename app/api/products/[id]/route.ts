import { connectDB } from "@/lib/mongodb";
import { getUserWarehouseId, requireSessionUser } from "@/lib/auth";
import { isValidObjectId } from "mongoose";
import Product from "@/models/Product";
import ProductHistory from "@/models/ProductHistory";
import Inventory from "@/models/Inventory";
import Warehouse from "@/models/Warehouse";
import Rack from "@/models/Rack";
import StockMovement from "@/models/StockMovement";
import Category from "@/models/Category";
import Zone from "@/models/Zone";
import { validConditionQuantities } from "@/lib/productCondition";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const user = await requireSessionUser();
    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      return Response.json({ success: false, message: "Unauthorized to move products" }, { status: 403 });
    }
    const { id } = await params;
    const { inventoryId, zoneId, rackId, sourceRackId } = await request.json();
    const validSourceRack = sourceRackId === "" || sourceRackId === null ||
      (typeof sourceRackId === "string" && isValidObjectId(sourceRackId));
    if (![id, inventoryId, zoneId, rackId].every((value) => typeof value === "string" && isValidObjectId(value)) || !validSourceRack) {
      return Response.json({ success: false, message: "Select a valid source location, destination Zone and Rack" }, { status: 400 });
    }
    const inventory = await Inventory.findOne({ _id: inventoryId, productId: id });
    if (!inventory) {
      return Response.json({ success: false, message: "Assigned location not found for this product" }, { status: 404 });
    }
    if (user.role === "STAFF" && !getUserWarehouseId(user).map(String).includes(String(inventory.warehouseId))) {
      return Response.json({ success: false, message: "You can only move products in your assigned warehouses" }, { status: 403 });
    }
    const currentRackId = inventory.rackId?.toString() || null;
    // Population returns null for deleted rack references, which the UI shows
    // as Unassigned. Accept that source only if it still has no existing rack.
    const sourceChanged = sourceRackId
      ? currentRackId !== sourceRackId
      : currentRackId && await Rack.exists({ _id: currentRackId });
    if (sourceChanged) {
      return Response.json({ success: false, message: "This product's location has changed. Refresh the product list and try again." }, { status: 409 });
    }
    if (currentRackId === rackId) {
      return Response.json({ success: false, message: "Select a different destination rack" }, { status: 400 });
    }
    const rack = await Rack.findOne({ _id: rackId, warehouseId: inventory.warehouseId, zoneId });
    const zone = await Zone.findOne({ _id: zoneId, warehouseId: inventory.warehouseId });
    if (!rack || !zone) {
      return Response.json({ success: false, message: "Destination rack must belong to the selected Zone and current warehouse" }, { status: 400 });
    }
    const occupied = await Inventory.findOne({ productId: id, warehouseId: inventory.warehouseId, rackId });
    if (occupied) {
      return Response.json({ success: false, message: "This product is already assigned to that rack. Select a different destination." }, { status: 409 });
    }
    // Only change the rack; quantities and product details are never written by Move.
    const moved = await Inventory.findOneAndUpdate(
      { _id: inventoryId, productId: id, warehouseId: inventory.warehouseId, rackId: inventory.rackId ?? null },
      { $set: { rackId } },
      { new: true, runValidators: true }
    );
    if (!moved) {
      return Response.json({ success: false, message: "This product's location has changed. Refresh the product list and try again." }, { status: 409 });
    }
    await ProductHistory.create({
      productId: id,
      action: "UPDATED",
      changedBy: user.id,
      changedFields: ["locations"],
      oldValues: { locations: [{ inventoryId, warehouseId: String(inventory.warehouseId), rackId: currentRackId, quantity: moved.quantity }] },
      newValues: { locations: [{ inventoryId, warehouseId: String(moved.warehouseId), zoneId, rackId, quantity: moved.quantity }] },
    });
    return Response.json({ success: true, data: moved, message: "Product moved successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }
    console.error("Move product error:", error);
    return Response.json({ success: false, message: "Unable to move product. Please try again." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const user = await requireSessionUser();

    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      return Response.json(
        { success: false, message: "Unauthorized to update products" },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (body.conditionStatus !== undefined && !["NEW", "USED", "GOOD_CONDITION", "DAMAGED", "SCRAP"].includes(body.conditionStatus)) {
      return Response.json({ success: false, message: "Select a valid product condition" }, { status: 400 });
    }

    if (body.productType !== undefined && body.productType !== null && body.productType !== "" && body.productType !== "REUSABLE" && body.productType !== "NON_REUSABLE") {
      return Response.json({ success: false, message: "Select Returnable or Non-Returnable as the product type" }, { status: 400 });
    }

    const oldProduct = await Product.findById(id).lean();
    if (!oldProduct) {
      return Response.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    const oldValues = oldProduct as unknown as Record<string, unknown>;
    const changedFields = Object.keys(body).filter((key) => {
      const oldVal = oldValues[key];
      const newVal = body[key];
      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    });

    if (!String(body.category !== undefined ? body.category || "" : oldProduct.category || "").trim()) {
      return Response.json(
        { success: false, message: "Category cannot be empty" },
        { status: 400 }
      );
    }

    // Validate all destinations before changing either product details or stock.
    const oldLocations: Record<string, unknown>[] = [];
    if (body.locations !== undefined && !Array.isArray(body.locations)) {
      return Response.json({ success: false, message: "Locations must be a list" }, { status: 400 });
    }
    if (Array.isArray(body.locations)) {
      const destinations = new Set<string>();
      const inventoryIds = new Set<string>();
      const allowedWarehouses = getUserWarehouseId(user).map(String);
      for (const loc of body.locations) {
        if (!loc || !isValidObjectId(loc.warehouseId) || !isValidObjectId(loc.rackId) ||
            (loc.inventoryId && !isValidObjectId(loc.inventoryId)) ||
            !Number.isFinite(Number(loc.quantity)) || Number(loc.quantity) < 0) {
          return Response.json({ success: false, message: "Each location needs a valid warehouse, rack and non-negative quantity" }, { status: 400 });
        }
        const destination = `${loc.warehouseId}/${loc.rackId}`;
        if (destinations.has(destination) || (loc.inventoryId && inventoryIds.has(loc.inventoryId))) {
          return Response.json({ success: false, message: "Each assigned location must use a different rack" }, { status: 400 });
        }
        destinations.add(destination);
        if (loc.inventoryId) inventoryIds.add(loc.inventoryId);
        if (user.role === "STAFF" && !allowedWarehouses.includes(String(loc.warehouseId))) {
          return Response.json({ success: false, message: "You can only relocate stock within your assigned warehouses" }, { status: 403 });
        }
        const rack = await Rack.findOne({ _id: loc.rackId, warehouseId: loc.warehouseId });
        if (!rack) {
          return Response.json({ success: false, message: "Selected rack does not belong to the selected warehouse" }, { status: 400 });
        }
        if (loc.zoneId) {
          if (!isValidObjectId(loc.zoneId) || String(rack.zoneId) !== String(loc.zoneId) ||
              !await Zone.findOne({ _id: loc.zoneId, warehouseId: loc.warehouseId })) {
            return Response.json({ success: false, message: "Selected rack does not belong to the selected zone" }, { status: 400 });
          }
        }
        if (loc.inventoryId) {
          const inventory = await Inventory.findOne({ _id: loc.inventoryId, productId: id });
          if (!inventory) {
            return Response.json({ success: false, message: "Assigned inventory does not belong to this product" }, { status: 400 });
          }
          if (user.role === "STAFF" && !allowedWarehouses.includes(String(inventory.warehouseId))) {
            return Response.json({ success: false, message: "You cannot relocate stock from an unassigned warehouse" }, { status: 403 });
          }
          oldLocations.push({ inventoryId: String(inventory._id), warehouseId: String(inventory.warehouseId), rackId: String(inventory.rackId), quantity: inventory.quantity });
          if (String(inventory.rackId) !== String(loc.rackId) || String(inventory.warehouseId) !== String(loc.warehouseId)) {
            const occupied = await Inventory.findOne({ productId: id, warehouseId: loc.warehouseId, rackId: loc.rackId, _id: { $ne: inventory._id } });
            if (occupied) {
              return Response.json({ success: false, message: "This product already has stock assigned to the destination rack. Choose a different rack." }, { status: 400 });
            }
          }
        }
      }
    }

    if (body.conditionQuantities !== undefined) {
      const inventories = await Inventory.find({ productId: id });
      let total = inventories.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
      for (const loc of body.locations || []) {
        const existing = loc.inventoryId ? inventories.find(inv => String(inv._id) === String(loc.inventoryId)) : undefined;
        total += Number(loc.quantity) - (existing?.quantity || 0);
      }
      if (!validConditionQuantities(body.conditionQuantities, total)) {
        return Response.json({ success: false, message: `New, Used, Damaged and Scrap quantities must be non-negative whole numbers and add up to total stock (${total}). Refresh stock if it has changed.` }, { status: 400 });
      }
    }

    let categoryId = body.categoryId;
    const categoryName = body.category !== undefined ? String(body.category).trim() : oldProduct.category;
    if (!categoryId && categoryName) {
      const catDoc = await Category.findOne({
        name: { $regex: new RegExp(`^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });
      if (catDoc) categoryId = catDoc._id;
    }

    const product = await Product.findByIdAndUpdate(
      id,
      {
        name: body.name,
        sku: body.sku,
        category: categoryName,
        productType: body.productType !== undefined ? body.productType : oldProduct.productType,
        categoryId: categoryId || oldProduct.categoryId,
        serviceIntervalMonths: body.serviceIntervalMonths !== undefined ? Number(body.serviceIntervalMonths) : 3,
        warrantyMonths: body.warrantyMonths !== undefined ? Number(body.warrantyMonths) : 12,
        serialNumber: body.serialNumber ? String(body.serialNumber).trim() : undefined,
        sellerName: body.sellerName !== undefined ? String(body.sellerName).trim() : oldProduct.sellerName,
        price: body.price === "" || body.price === null ? 0 : body.price !== undefined && !isNaN(Number(body.price)) ? Number(body.price) : (oldProduct.price ?? 0),
        description: body.description,
        status: body.status,
        conditionStatus: body.conditionStatus !== undefined ? body.conditionStatus : oldProduct.conditionStatus ?? "GOOD_CONDITION",
        ...(body.conditionQuantities !== undefined ? { conditionQuantities: body.conditionQuantities } : {}),
      },
      { new: true, runValidators: true }
    ).populate("categoryId", "name code");

    if (!product) {
      return Response.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    // Handle inventory locations update if passed
    if (Array.isArray(body.locations)) {
      for (const loc of body.locations) {
        const qty = Math.max(0, Number(loc.quantity) || 0);
        let status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK" = "AVAILABLE";
        if (qty === 0) status = "OUT_OF_STOCK";
        else if (qty <= 10) status = "LOW_STOCK";

        if (loc.inventoryId) {
          // Existing inventory record
          const oldInv = await Inventory.findById(loc.inventoryId);
          if (oldInv) {
            const oldQty = oldInv.quantity || 0;
            const diff = qty - oldQty;

            if (loc.rackId && loc.rackId !== oldInv.rackId?.toString()) {
              oldInv.rackId = loc.rackId;
            }
            if (loc.warehouseId && loc.warehouseId !== oldInv.warehouseId?.toString()) {
              oldInv.warehouseId = loc.warehouseId;
            }

            oldInv.quantity = qty;
            oldInv.status = status;
            await oldInv.save();

            if (diff !== 0) {
              const wh = await Warehouse.findById(oldInv.warehouseId);
              const rk = await Rack.findById(oldInv.rackId);
              await StockMovement.create({
                productId: product._id,
                productName: product.name,
                sku: product.sku,
                category: product.category,
                productType: product.productType,
                warehouseId: oldInv.warehouseId,
                warehouseName: wh?.name || "Warehouse",
                rackId: oldInv.rackId,
                rackName: rk?.name || "Rack",
                movementType: diff > 0 ? "INWARD" : "OUTWARD",
                reason: diff > 0 ? "RESTOCK" : "ADJUSTMENT",
                quantity: Math.abs(diff),
                unitPrice: product.price || 0,
                totalValue: (product.price || 0) * Math.abs(diff),
                referenceNumber: "PRODUCT-EDIT-STOCK",
                entityName: `${wh?.name || "Warehouse"} / ${rk?.name || "Rack"}`,
                notes: `Stock changed from ${oldQty} to ${qty} in Product Edit`,
                performedBy: user.id,
                performedByName: user.name,
              });
            }
          }
        } else if (loc.warehouseId && loc.rackId && qty > 0) {
          // New warehouse location added
          let inv = await Inventory.findOne({
            productId: product._id,
            warehouseId: loc.warehouseId,
            rackId: loc.rackId,
          });

          if (inv) {
            const oldQty = inv.quantity || 0;
            inv.quantity = oldQty + qty;
            inv.status = inv.quantity === 0 ? "OUT_OF_STOCK" : inv.quantity <= 10 ? "LOW_STOCK" : "AVAILABLE";
            await inv.save();
          } else {
            inv = await Inventory.create({
              productId: product._id,
              warehouseId: loc.warehouseId,
              rackId: loc.rackId,
              quantity: qty,
              status,
            });
          }

          const wh = await Warehouse.findById(loc.warehouseId);
          const rk = await Rack.findById(loc.rackId);
          await StockMovement.create({
            productId: product._id,
            productName: product.name,
            sku: product.sku,
            category: product.category,
            productType: product.productType,
            warehouseId: loc.warehouseId,
            warehouseName: wh?.name || "Warehouse",
            rackId: loc.rackId,
            rackName: rk?.name || "Rack",
            movementType: "INWARD",
            reason: "RESTOCK",
            quantity: qty,
            unitPrice: product.price || 0,
            totalValue: (product.price || 0) * qty,
            referenceNumber: "PRODUCT-EDIT-ADD-LOCATION",
            entityName: `${wh?.name || "Warehouse"} / ${rk?.name || "Rack"}`,
            notes: `Added ${qty} units to ${wh?.name || "Warehouse"} in Product Edit`,
            performedBy: user.id,
            performedByName: user.name,
          });
        }
      }
    }

    if (changedFields.length > 0) {
      await ProductHistory.create({
        productId: product._id,
        action: "UPDATED",
        changedBy: user.id,
        changedFields,
        oldValues: { ...oldValues, ...(body.locations ? { locations: oldLocations } : {}) },
        newValues: body as Record<string, unknown>,
      });
    }

    return Response.json({ success: true, data: product });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("PUT product error:", error);

    // Duplicate key error for SKU
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return Response.json(
        {
          success: false,
          message: "A product with this SKU already exists",
        },
        { status: 409 }
      );
    }

    return Response.json(
      {
        success: false,
        message: "Failed to update product",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only admin can delete products" },
        { status: 403 }
      );
    }

    const product = await Product.findById(id).lean();

    if (!product) {
      return Response.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    const productObj = product as unknown as Record<string, unknown>;

    await Product.findByIdAndDelete(id);

    await ProductHistory.create({
      productId: product._id,
      action: "DELETED",
      changedBy: user.id,
      oldValues: productObj,
    });

    return Response.json({ success: true, message: "Product deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("DELETE product error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to delete product",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
