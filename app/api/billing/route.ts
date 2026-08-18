import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Inventory from "@/models/Inventory";
import Product from "@/models/Product";
import Warehouse from "@/models/Warehouse";
import Rack from "@/models/Rack";
import Invoice from "@/models/Invoice";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Ensure referenced models are registered
    void Product;
    void Warehouse;
    void Rack;
    void Inventory;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("search");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (query?.trim()) {
      const regex = { $regex: query.trim(), $options: "i" };
      filter.$or = [
        { invoiceNumber: regex },
        { customerName: regex },
        { customerPhone: regex },
        { paymentMethod: regex },
      ];
    }

    if (pageParam || limitParam) {
      const page = Math.max(1, parseInt(pageParam || "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(limitParam || "10", 10)));
      const skip = (page - 1) * limit;

      const [total, invoices] = await Promise.all([
        Invoice.countDocuments(filter),
        Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ]);

      return Response.json({
        success: true,
        data: invoices,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    const invoices = await Invoice.find(filter).sort({ createdAt: -1 });

    return Response.json({
      success: true,
      data: invoices,
      count: invoices.length,
    });
  } catch (error) {
    console.error("GET /api/billing error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to fetch invoices",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    void Product;
    void Warehouse;
    void Rack;
    void Inventory;

    const body = await request.json();
    const {
      customerName,
      customerPhone,
      customerAddress,
      items,
      discount = 0,
      tax = 0,
      paymentMethod = "CASH",
      notes = "",
    } = body;

    if (!customerName || !customerName.trim()) {
      return Response.json(
        {
          success: false,
          message: "Customer name is required",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json(
        {
          success: false,
          message: "At least one item is required to generate a bill",
        },
        { status: 400 }
      );
    }

    // Step 1: Validate stock availability for all items before making any modifications
    const inventoryUpdates: {
      inventoryDoc: any;
      dispatchQty: number;
      productName: string;
      sku: string;
      warehouseName: string;
      rackName: string;
      unitPrice: number;
      total: number;
    }[] = [];

    for (const item of items) {
      const { inventoryId, quantity } = item;
      const qtyNum = Number(quantity);

      if (!inventoryId || !qtyNum || qtyNum <= 0) {
        return Response.json(
          {
            success: false,
            message: "Invalid inventory item or quantity",
          },
          { status: 400 }
        );
      }

      const inv = await Inventory.findById(inventoryId)
        .populate("productId")
        .populate("warehouseId")
        .populate("rackId");

      if (!inv) {
        return Response.json(
          {
            success: false,
            message: `Inventory item not found for ID ${inventoryId}`,
          },
          { status: 404 }
        );
      }

      if (inv.quantity < qtyNum) {
        const prodName = (inv.productId as any)?.name || "Selected product";
        return Response.json(
          {
            success: false,
            message: `Insufficient stock for "${prodName}". Available: ${inv.quantity}, Requested: ${qtyNum}`,
          },
          { status: 400 }
        );
      }

      const prod = inv.productId as any;
      const wh = inv.warehouseId as any;
      const rk = inv.rackId as any;

      const unitPrice = Number(prod?.price) || 0;
      const lineTotal = unitPrice * qtyNum;

      inventoryUpdates.push({
        inventoryDoc: inv,
        dispatchQty: qtyNum,
        productName: prod?.name || "Product",
        sku: prod?.sku || "N/A",
        warehouseName: wh?.name || "Warehouse",
        rackName: rk?.name || "Rack",
        unitPrice,
        total: lineTotal,
      });
    }

    // Step 2: Deduct stock and update inventory status for each item
    const invoiceItems = [];
    let subtotal = 0;

    for (const update of inventoryUpdates) {
      const inv = update.inventoryDoc;
      const newQty = inv.quantity - update.dispatchQty;

      let newStatus: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK" = "AVAILABLE";
      if (newQty === 0) {
        newStatus = "OUT_OF_STOCK";
      } else if (newQty <= 10) {
        newStatus = "LOW_STOCK";
      }

      inv.quantity = newQty;
      inv.status = newStatus;
      await inv.save();

      subtotal += update.total;

      invoiceItems.push({
        inventoryId: inv._id,
        productId: inv.productId._id,
        productName: update.productName,
        sku: update.sku,
        warehouseId: inv.warehouseId._id,
        warehouseName: update.warehouseName,
        rackId: inv.rackId._id,
        rackName: update.rackName,
        quantity: update.dispatchQty,
        unitPrice: update.unitPrice,
        total: update.total,
      });
    }

    // Step 3: Compute totals and unique invoice number
    const discountNum = Number(discount) || 0;
    const taxNum = Number(tax) || 0;
    const grandTotal = Math.max(0, subtotal - discountNum + taxNum);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${dateStr}-${randomSuffix}`;

    // Step 4: Create Invoice record
    const invoice = await Invoice.create({
      invoiceNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone?.trim(),
      customerAddress: customerAddress?.trim(),
      items: invoiceItems,
      subtotal,
      discount: discountNum,
      tax: taxNum,
      grandTotal,
      paymentMethod,
      notes: notes?.trim(),
    });

    return Response.json(
      {
        success: true,
        message: "Invoice created & stock dispatched successfully",
        data: invoice,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/billing error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to process bill and dispatch stock",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
