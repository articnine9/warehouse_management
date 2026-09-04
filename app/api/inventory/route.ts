import { connectDB } from "@/lib/mongodb";
import { getUserWarehouseId, requireSessionUser } from "@/lib/auth";
import Inventory from "@/models/Inventory";
import Product from "@/models/Product";
import Warehouse from "@/models/Warehouse";
import Rack from "@/models/Rack";
import StockMovement from "@/models/StockMovement";

export async function GET(request: Request) {
    try {
        await connectDB();
        void Product;
        void Warehouse;
        void Rack;

        const user = await requireSessionUser();
        const { searchParams } = new URL(request.url);

        const staffWarehouseId = getUserWarehouseId(user);
        const warehouseParam = searchParams.get("warehouseId");
        const statusParam = searchParams.get("status");
        const queryParam = searchParams.get("q") || searchParams.get("search");

        // Build filter
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filter: Record<string, any> = {};

        // Role restriction for staff
        if (user.role === "STAFF" && staffWarehouseId) {
            filter.warehouseId = staffWarehouseId;
        } else if (warehouseParam && warehouseParam !== "ALL") {
            filter.warehouseId = warehouseParam;
        }

        // Status filter
        if (statusParam && statusParam !== "ALL") {
            if (statusParam === "LOW_OUT") {
                filter.status = { $in: ["LOW_STOCK", "OUT_OF_STOCK"] };
            } else {
                filter.status = statusParam;
            }
        }

        // If search query is provided, find matching product IDs or rack IDs
        if (queryParam?.trim()) {
            const regex = new RegExp(queryParam.trim(), "i");
            const [matchingProducts, matchingRacks, matchingWarehouses] = await Promise.all([
                Product.find({ $or: [{ name: regex }, { sku: regex }, { sellerName: regex }, { category: regex }] }).select("_id"),
                Rack.find({ $or: [{ name: regex }, { code: regex }] }).select("_id"),
                Warehouse.find({ $or: [{ name: regex }, { code: regex }] }).select("_id"),
            ]);

            const pIds = matchingProducts.map((p) => p._id);
            const rIds = matchingRacks.map((r) => r._id);
            const wIds = matchingWarehouses.map((w) => w._id);

            filter.$or = [
                { productId: { $in: pIds } },
                { rackId: { $in: rIds } },
                { warehouseId: { $in: wIds } },
            ];
        }

        const pageParam = searchParams.get("page");
        const limitParam = searchParams.get("limit");

        // If pagination parameters are specified
        if (pageParam || limitParam) {
            const page = Math.max(1, parseInt(pageParam || "1", 10));
            const limit = Math.min(100, Math.max(1, parseInt(limitParam || "10", 10)));
            const skip = (page - 1) * limit;

            const [total, inventory] = await Promise.all([
                Inventory.countDocuments(filter),
                Inventory.find(filter)
                    .populate("productId", "name sku price sellerName category productType returnDays serviceIntervalMonths warrantyMonths serialNumber")
                    .populate("warehouseId", "name code")
                    .populate("rackId", "name code")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
            ]);

            return Response.json({
                success: true,
                data: inventory,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            });
        }

        // Return all records (used for selection dropdowns / backward compatibility)
        const inventory = await Inventory.find(filter)
            .populate("productId", "name sku price sellerName category productType returnDays serviceIntervalMonths warrantyMonths serialNumber")
            .populate("warehouseId", "name code")
            .populate("rackId", "name code")
            .sort({
                createdAt: -1,
            });

        return Response.json({
            success: true,
            data: inventory,
            count: inventory.length,
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

        console.error("GET inventory error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to fetch inventory",
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
            return Response.json(
                {
                    success: false,
                    message: "Only admin can add inventory",
                },
                { status: 403 }
            );
        }

        const body = await request.json();

        const {
            productId,
            warehouseId,
            rackId,
            quantity,
        } = body;

        if (
            !productId ||
            !warehouseId ||
            !rackId ||
            quantity === undefined
        ) {
            return Response.json(
                {
                    success: false,
                    message: "All inventory fields are required",
                },
                { status: 400 }
            );
        }

        const rack = await Rack.findOne({
            _id: rackId,
            warehouseId: warehouseId,
        });

        if (!rack) {
            return Response.json(
                {
                    success: false,
                    message:
                        "Selected rack does not belong to the selected warehouse",
                },
                { status: 400 }
            );
        }

        let inventory = await Inventory.findOne({
            productId,
            warehouseId,
            rackId,
        });

        if (inventory) {
            inventory.quantity = (inventory.quantity || 0) + Number(quantity);
            if (inventory.quantity === 0) {
                inventory.status = "OUT_OF_STOCK";
            } else if (inventory.quantity <= 10) {
                inventory.status = "LOW_STOCK";
            } else {
                inventory.status = "AVAILABLE";
            }
            await inventory.save();
        } else {
            let status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
            const numQty = Number(quantity);
            if (numQty === 0) {
                status = "OUT_OF_STOCK";
            } else if (numQty <= 10) {
                status = "LOW_STOCK";
            } else {
                status = "AVAILABLE";
            }

            inventory = await Inventory.create({
                productId,
                warehouseId,
                rackId,
                quantity: numQty,
                status,
            });
        }

        const populatedInventory = await Inventory.findById(
            inventory._id
        )
            .populate("productId", "name sku price category")
            .populate("warehouseId", "name code")
            .populate("rackId", "name code");

        // Log Inward Stock Movement
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = populatedInventory?.productId as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const w = populatedInventory?.warehouseId as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = populatedInventory?.rackId as any;

            if (p) {
                const priorMovementsCount = await StockMovement.countDocuments({
                    $or: [{ productId: p._id }, { sku: p.sku }],
                });
                const isFirstAddition = priorMovementsCount === 0;

                await StockMovement.create({
                    productId: p._id,
                    productName: p.name,
                    sku: p.sku,
                    category: p.category,
                    warehouseId: w?._id,
                    warehouseName: w?.name,
                    rackId: r?._id,
                    rackName: r?.name,
                    movementType: "INWARD",
                    reason: isFirstAddition ? "INITIAL_STOCK" : "RESTOCK",
                    quantity: Number(quantity),
                    unitPrice: p.price || 0,
                    totalValue: (p.price || 0) * Number(quantity),
                    referenceNumber: isFirstAddition ? "INITIAL-STOCK" : "RESTOCK",
                    entityName: isFirstAddition
                        ? (p.sellerName ? `Received from ${p.sellerName}` : `Initial stock in ${w?.name || "Warehouse"}`)
                        : `Added to ${w?.name || "Warehouse"} / ${r?.name || "Rack"}`,
                    notes: isFirstAddition ? "First initial stock arrival into warehouse" : undefined,
                    performedBy: user.id,
                    performedByName: user.name,
                });
            }
        } catch (logErr) {
            console.error("Failed to log stock movement in POST /api/inventory:", logErr);
        }

        return Response.json(
            {
                success: true,
                data: populatedInventory,
            },
            { status: 201 }
        );
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

        console.error("POST inventory error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to create inventory",
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            },
            { status: 500 }
        );
    }
}
