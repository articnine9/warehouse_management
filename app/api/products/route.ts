import { connectDB } from "@/lib/mongodb";
import { getUserWarehouseId, requireSessionUser } from "@/lib/auth";
import { productStockStatus } from "@/lib/productStock";
import { validConditionQuantities } from "@/lib/productCondition";
import type { ProductExportLocation } from "@/lib/productExportTypes";
import Product from "@/models/Product";
import ProductHistory from "@/models/ProductHistory";
import Inventory from "@/models/Inventory";
import Warehouse from "@/models/Warehouse";
import Zone from "@/models/Zone";
import Rack from "@/models/Rack";
import StockMovement from "@/models/StockMovement";
import Category from "@/models/Category";
export async function GET(request: Request) {
  try {
    await connectDB();
    const user = await requireSessionUser();
    await Product.updateMany(
      { $or: [{ conditionStatus: { $exists: false } }, { conditionStatus: null }] },
      { $set: { conditionStatus: "GOOD_CONDITION" } }
    );
    // Ensure models are registered for Mongoose population
    void Warehouse;
    void Zone;
    void Rack;
    void Product;
    void Inventory;
    void Category;
    const { searchParams } = new URL(request.url);
    const exportView = searchParams.get("export") === "excel";
    const stockView = exportView || searchParams.get("view") === "stock";
    const checkNameParam = exportView ? null : searchParams.get("checkName");
    if (checkNameParam?.trim()) {
      const trimmed = checkNameParam.trim();
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Partial match: find products whose name contains the search term
      const existingProducts = await Product.find({
        name: { $regex: new RegExp(escaped, "i") },
      })
        .limit(5)
        .sort({ name: 1 });
      if (existingProducts.length > 0) {
        const productIds = existingProducts.map((p) => p._id);
        const inventories = await Inventory.find({ productId: { $in: productIds } })
          .populate("warehouseId", "name code")
          .populate({
            path: "rackId",
            select: "name code zoneId",
            populate: {
              path: "zoneId",
              select: "name code",
            },
          });
        const enriched = existingProducts.map((p) => {
          const pid = p._id.toString();
          const prodInvs = inventories.filter(
            (inv) => inv.productId.toString() === pid
          );
          const totalStock = prodInvs.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
          const locations = prodInvs.map((inv) => {
            const w = inv.warehouseId as any;
            const r = inv.rackId as any;
            const z = r?.zoneId as any;
            return {
              warehouseId: w?._id?.toString() || "",
              warehouseName: w?.name || "Unassigned",
              zoneId: z?._id?.toString() || (typeof r?.zoneId === "string" ? r.zoneId : ""),
              zoneName: z?.name || "",
              rackId: r?._id?.toString() || "",
              rackName: r?.name || "Unassigned",
              quantity: inv.quantity || 0,
            };
          });
          return {
            _id: pid,
            name: p.name,
            sku: p.sku,
            category: p.category,
            productType: p.productType,
            price: p.price,
            totalStock,
            locations,
          };
        });
        return Response.json({
          success: true,
          exists: true,
          products: enriched,
        });
      }
      return Response.json({ success: true, exists: false, products: [] });
    }
    const query = exportView ? null : searchParams.get("q") || searchParams.get("query") || searchParams.get("search");
    const categoryParam = exportView ? null : searchParams.get("category");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    // Build filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const andClauses: any[] = [];
    if (categoryParam && categoryParam !== "ALL") {
      const trimmedCat = categoryParam.trim();
      const escapedCat = trimmedCat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matchedCat = await Category.findOne({
        name: { $regex: new RegExp(`^${escapedCat}$`, "i") },
      });

      if (matchedCat) {
        andClauses.push({
          $or: [
            { categoryId: matchedCat._id },
            { category: matchedCat.name },
            { category: { $regex: new RegExp(`^${escapedCat}$`, "i") } },
          ],
        });
      } else {
        andClauses.push({
          category: { $regex: new RegExp(`^${escapedCat}$`, "i") },
        });
      }
    }
    if (query?.trim()) {
      const regex = { $regex: query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      const [matchingWarehouses, matchingZones, matchingRacks] = await Promise.all([
        Warehouse.find({ $or: [{ name: regex }, { code: regex }] }).select("_id"),
        Zone.find({ $or: [{ name: regex }, { code: regex }] }).select("_id"),
        Rack.find({ $or: [{ name: regex }, { code: regex }] }).select("_id"),
      ]);
      const wIds = matchingWarehouses.map((w) => w._id);
      const zIds = matchingZones.map((z) => z._id);
      let racksInMatchingZones: any[] = [];
      if (zIds.length) {
        racksInMatchingZones = await Rack.find({ zoneId: { $in: zIds } }).select("_id");
      }
      const allRkIds = Array.from(
        new Set([
          ...matchingRacks.map((r) => r._id.toString()),
          ...racksInMatchingZones.map((r) => r._id.toString()),
        ])
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let invProductIds: any[] = [];
      if (wIds.length || allRkIds.length) {
        const invs = await Inventory.find({
          ...(stockView && user.role === "STAFF" ? { warehouseId: { $in: getUserWarehouseId(user) } } : {}),
          $or: [
            ...(wIds.length ? [{ warehouseId: { $in: wIds } }] : []),
            ...(allRkIds.length ? [{ rackId: { $in: allRkIds } }] : []),
          ],
        }).select("productId");
        invProductIds = invs.map((i) => i.productId);
      }
      andClauses.push({
        $or: [
          { name: regex },
          { sku: regex },
          { sellerName: regex },
          { category: regex },
          ...(invProductIds.length ? [{ _id: { $in: invProductIds } }] : []),
        ],
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = andClauses.length > 0 ? { $and: andClauses } : {};
    // Helper to enrich products with warehouse, zone & rack inventory details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichProductsWithStock = async (productList: any[]) => {
      if (!productList.length) return [];
      const productIds = productList.map((p) => p._id);
      const inventories = await Inventory.find({
        productId: { $in: productIds },
        ...(stockView && user.role === "STAFF" ? { warehouseId: { $in: getUserWarehouseId(user) } } : {}),
      })
        .populate("warehouseId", exportView ? "name code address status" : "name code")
        .populate({
          path: "rackId",
          select: exportView ? "name code zoneId status" : "name code zoneId",
          populate: {
            path: "zoneId",
            select: exportView ? "name code status" : "name code",
          },
        });
      const invMap = new Map<string, ProductExportLocation[]>();
      const stockMap = new Map<string, number>();
      for (const inv of inventories) {
        const pid = inv.productId.toString();
        stockMap.set(pid, (stockMap.get(pid) || 0) + (inv.quantity || 0));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = inv.warehouseId as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = inv.rackId as any;
        const z = r?.zoneId as any;
        const list = invMap.get(pid) || [];
        list.push({
          inventoryId: inv._id.toString(),
          warehouseId: w?._id?.toString() || "",
          warehouseName: w?.name || "Unassigned",
          warehouseCode: w?.code || "",
          zoneId: z?._id?.toString() || (typeof r?.zoneId === "string" ? r.zoneId : ""),
          zoneName: z?.name || "",
          rackId: r?._id?.toString() || "",
          rackName: r?.name || "Unassigned",
          rackCode: r?.code || "",
          quantity: inv.quantity || 0,
          ...(exportView ? {
            warehouseAddress: w?.address || "",
            warehouseStatus: w?.status || "",
            zoneCode: z?.code || "",
            zoneStatus: z?.status || "",
            rackStatus: r?.status || "",
            status: productStockStatus(inv.quantity || 0),
            recordedStatus: inv.status || "",
            createdAt: inv.createdAt?.toISOString(),
            updatedAt: inv.updatedAt?.toISOString(),
          } : {}),
        });
        invMap.set(pid, list);
      }
      return productList.map((p) => {
        const obj = typeof p.toObject === "function" ? p.toObject() : p;
        const pid = obj._id.toString();
        return {
          ...obj,
          totalStock: stockMap.get(pid) || 0,
          stockStatus: productStockStatus(stockMap.get(pid) || 0),
          locations: invMap.get(pid) || [],
        };
      });
    };
    if (exportView) {
      const rawProducts = await Product.find({}).populate("categoryId", "name code").sort({ name: 1, _id: 1 });
      const products = (await enrichProductsWithStock(rawProducts)).filter((product) => user.role !== "STAFF" || product.locations.length > 0);
      return Response.json({ success: true, data: products, count: products.length, export: {
        generatedAt: new Date().toISOString(),
        scope: user.role === "STAFF" ? "ASSIGNED_WAREHOUSES" : "ALL_WAREHOUSES",
      } });
    }
    if (stockView) {
      // Group and filter the complete product before pagination. A product in
      // multiple racks must never consume several rows or cross page boundaries.
      const rawProducts = await Product.find(filter).populate("categoryId", "name code").sort({ createdAt: -1, _id: -1 });
      const status = searchParams.get("status") || "ALL";
      const products = (await enrichProductsWithStock(rawProducts)).filter((product) =>
        (user.role !== "STAFF" || product.locations.length > 0) &&
        (status === "ALL" || (status === "LOW_OUT" ? product.stockStatus !== "AVAILABLE" : product.stockStatus === status))
      );
      const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(limitParam || "5", 10) || 5));
      return Response.json({ success: true, data: products.slice((page - 1) * limit, page * limit), pagination: {
        total: products.length, page, limit, totalPages: Math.ceil(products.length / limit),
      } });
    }
    if (pageParam || limitParam) {
      const page = Math.max(1, parseInt(pageParam || "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(limitParam || "10", 10)));
      const skip = (page - 1) * limit;
      const [total, rawProducts] = await Promise.all([
        Product.countDocuments(filter),
        Product.find(filter)
          .populate("categoryId", "name code")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);
      const products = await enrichProductsWithStock(rawProducts);
      return Response.json({
        success: true,
        data: products,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
    const rawProducts = await Product.find(filter)
      .populate("categoryId", "name code")
      .sort({
        createdAt: -1,
      });
    const products = await enrichProductsWithStock(rawProducts);
    return Response.json({
      success: true,
      data: products,
      count: products.length,
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
    console.error("GET /api/products error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to fetch products",
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
    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      return Response.json(
        {
          success: false,
          message: "Unauthorized to add products",
        },
        { status: 403 }
      );
    }
    const body = await request.json();
    // Handle restocking existing product directly
    if (body.action === "RESTOCK_EXISTING") {
      const {
        existingProductId,
        warehouseId,
        rackId,
        quantity,
      } = body;
      if (!existingProductId || !warehouseId || !rackId || quantity === undefined) {
        return Response.json(
          {
            success: false,
            message: "Product, warehouse, rack, and quantity are required to add stock",
          },
          { status: 400 }
        );
      }
      const existingProduct = await Product.findById(existingProductId);
      if (!existingProduct) {
        return Response.json(
          {
            success: false,
            message: "Target product not found",
          },
          { status: 404 }
        );
      }
      const rackDoc = await Rack.findOne({
        _id: rackId,
        warehouseId: warehouseId,
      });
      if (!rackDoc) {
        return Response.json(
          {
            success: false,
            message: "Selected rack does not belong to the selected warehouse",
          },
          { status: 400 }
        );
      }
      const warehouseDoc = await Warehouse.findById(warehouseId);
      const addQty = Math.max(1, Number(quantity) || 1);
      let inv = await Inventory.findOne({
        productId: existingProductId,
        warehouseId,
        rackId,
      });
      if (inv) {
        inv.quantity = (inv.quantity || 0) + addQty;
        if (inv.quantity === 0) {
          inv.status = "OUT_OF_STOCK";
        } else if (inv.quantity <= 10) {
          inv.status = "LOW_STOCK";
        } else {
          inv.status = "AVAILABLE";
        }
        await inv.save();
      } else {
        const invStatus = addQty === 0 ? "OUT_OF_STOCK" : addQty <= 10 ? "LOW_STOCK" : "AVAILABLE";
        inv = await Inventory.create({
          productId: existingProductId,
          warehouseId,
          rackId,
          quantity: addQty,
          status: invStatus,
        });
      }
      // Log Stock Movement
      try {
        await StockMovement.create({
          productId: existingProduct._id,
          productName: existingProduct.name,
          sku: existingProduct.sku,
          category: existingProduct.category,
          productType: existingProduct.productType,
          warehouseId: warehouseDoc?._id || warehouseId,
          warehouseName: warehouseDoc?.name || "Warehouse",
          rackId: rackDoc._id,
          rackName: rackDoc.name,
          movementType: "INWARD",
          reason: "RESTOCK",
          quantity: addQty,
          unitPrice: existingProduct.price || 0,
          totalValue: (existingProduct.price || 0) * addQty,
          referenceNumber: "RESTOCK",
          entityName: `Stock added to ${warehouseDoc?.name || "Warehouse"} / ${rackDoc.name}`,
          notes: `Restocked ${addQty} units for existing product "${existingProduct.name}"`,
          performedBy: user.id,
          performedByName: user.name,
        });
      } catch (smErr) {
        console.error("Failed to log stock movement in RESTOCK_EXISTING:", smErr);
      }
      return Response.json({
        success: true,
        restocked: true,
        data: existingProduct,
        message: `Successfully added ${addQty} units to existing product "${existingProduct.name}".`,
      });
    }
    const trimmedName = String(body.name || "").trim();
    if (!trimmedName) {
      return Response.json(
        {
          success: false,
          message: "Product name is required",
        },
        { status: 400 }
      );
    }
    // Check if a product with the same name already exists
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existingSameName = await Product.findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, "i") },
    });
    if (existingSameName && !body.allowDuplicate) {
      const inventories = await Inventory.find({ productId: existingSameName._id });
      const totalStock = inventories.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
      return Response.json(
        {
          success: false,
          isDuplicate: true,
          existingProduct: {
            _id: existingSameName._id.toString(),
            name: existingSameName.name,
            sku: existingSameName.sku,
            category: existingSameName.category,
            price: existingSameName.price,
            sellerName: existingSameName.sellerName,
            totalStock,
          },
          message: `A product named "${existingSameName.name}" already exists in the catalog (SKU: ${existingSameName.sku}).`,
        },
        { status: 409 }
      );
    }
    const {
      warehouseId,
      rackId,
      initialQuantity,
    } = body;
    const categoryName = String(body.category || "").trim();
    if (!categoryName) {
      return Response.json(
        {
          success: false,
          message: "Category is required to add a product",
        },
        { status: 400 }
      );
    }
    if (!warehouseId || !rackId) {
      return Response.json(
        {
          success: false,
          message: "Warehouse and rack are required to add a product",
        },
        { status: 400 }
      );
    }
    const rackDoc = await Rack.findOne({
      _id: rackId,
      warehouseId: warehouseId,
    });
    if (!rackDoc) {
      return Response.json(
        {
          success: false,
          message: "Selected rack does not belong to the selected warehouse",
        },
        { status: 400 }
      );
    }
    const warehouseDoc = await Warehouse.findById(warehouseId);
    if (body.conditionQuantities !== undefined && !validConditionQuantities(body.conditionQuantities, Number(initialQuantity) || 0)) {
      return Response.json({ success: false, message: "Good, Damaged and Scrap quantities must be non-negative whole numbers and add up to initial stock." }, { status: 400 });
    }
    let categoryId = body.categoryId;
    if (!categoryId && categoryName) {
      const catDoc = await Category.findOne({
        name: { $regex: new RegExp(`^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });
      if (catDoc) categoryId = catDoc._id;
    }
    const product = await Product.create({
      name: trimmedName,
      sku: body.sku,
      category: categoryName,
      categoryId,
      serviceIntervalMonths: body.serviceIntervalMonths !== undefined ? Number(body.serviceIntervalMonths) : 3,
      warrantyMonths: body.warrantyMonths !== undefined ? Number(body.warrantyMonths) : 12,
      productType: body.productType === "REUSABLE" ? "REUSABLE" : body.productType === "NON_REUSABLE" ? "NON_REUSABLE" : undefined,
      returnDueDays: body.productType === "REUSABLE" ? Math.max(1, Number(body.returnDueDays) || 30) : undefined,
      serialNumber: body.serialNumber ? String(body.serialNumber).trim() : undefined,
      sellerName: body.sellerName ? String(body.sellerName).trim() : "",
      price: body.price !== undefined && body.price !== null && body.price !== "" && !isNaN(Number(body.price)) ? Number(body.price) : 0,
      description: body.description,
      status: body.status ?? "ACTIVE",
      conditionStatus: body.conditionStatus ?? "GOOD_CONDITION",
      conditionQuantities: body.conditionQuantities,
    });
    // Create initial Inventory stock record if warehouse & rack were provided
    if (warehouseId && rackId && rackDoc) {
      const qty = Math.max(0, Number(initialQuantity) || 0);
      let invStatus: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK" = "AVAILABLE";
      if (qty === 0) {
        invStatus = "OUT_OF_STOCK";
      } else if (qty <= 10) {
        invStatus = "LOW_STOCK";
      } else {
        invStatus = "AVAILABLE";
      }
      await Inventory.create({
        productId: product._id,
        warehouseId: warehouseId,
        rackId: rackId,
        quantity: qty,
        status: invStatus,
      });
      // Log Inward Stock Movement if quantity > 0
      if (qty > 0) {
        try {
          await StockMovement.create({
            productId: product._id,
            productName: product.name,
            sku: product.sku,
            category: product.category,
            productType: product.productType,
            warehouseId: warehouseDoc?._id || warehouseId,
            warehouseName: warehouseDoc?.name || "Warehouse",
            rackId: rackDoc._id,
            rackName: rackDoc.name,
            movementType: "INWARD",
            reason: "INITIAL_STOCK",
            quantity: qty,
            unitPrice: product.price || 0,
            totalValue: (product.price || 0) * qty,
            referenceNumber: "INITIAL-STOCK",
            entityName: product.sellerName
              ? `Received from ${product.sellerName}`
              : `Initial stock in ${warehouseDoc?.name || "Warehouse"}`,
            notes: "Initial stock created during product registration",
            performedBy: user.id,
            performedByName: user.name,
          });
        } catch (movErr) {
          console.error("Failed to log stock movement during product creation:", movErr);
        }
      }
    }
    await ProductHistory.create({
      productId: product._id,
      action: "CREATED",
      changedBy: user.id,
      changedFields: Object.keys(body),
      newValues: body as Record<string, unknown>,
    });
    return Response.json(
      {
        success: true,
        data: product,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        {
          success: false,
          message: "Not authenticated",
        },
        { status: 401 }
      );
    }
    console.error("POST product error:", error);
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
        message: "Failed to create product",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
