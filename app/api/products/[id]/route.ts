import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Product from "@/models/Product";
import ProductHistory from "@/models/ProductHistory";
import Inventory from "@/models/Inventory";
import Warehouse from "@/models/Warehouse";
import Rack from "@/models/Rack";
import StockMovement from "@/models/StockMovement";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only admin can update products" },
        { status: 403 }
      );
    }

    const body = await request.json();

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

    const product = await Product.findByIdAndUpdate(
      id,
      {
        name: body.name,
        sku: body.sku,
        category: body.category,
        categoryId: body.categoryId,
        serviceIntervalMonths: body.serviceIntervalMonths !== undefined ? Number(body.serviceIntervalMonths) : 3,
        warrantyMonths: body.warrantyMonths !== undefined ? Number(body.warrantyMonths) : 12,
        serialNumber: body.serialNumber ? String(body.serialNumber).trim() : undefined,
        sellerName: body.sellerName,
        price: Number(body.price),
        description: body.description,
        status: body.status,
      },
      { new: true }
    ).populate("categoryId", "name code");

    if (!product) {
      return Response.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    if (changedFields.length > 0) {
      await ProductHistory.create({
        productId: product._id,
        action: "UPDATED",
        changedBy: user.id,
        changedFields,
        oldValues: oldValues as Record<string, unknown>,
        newValues: body as Record<string, unknown>,
      });
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
