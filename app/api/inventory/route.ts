import { connectDB } from "@/lib/mongodb";
import { getUserWarehouseId, requireSessionUser } from "@/lib/auth";
import Inventory from "@/models/Inventory";
import Product from "@/models/Product";
import Warehouse from "@/models/Warehouse";
import Rack from "@/models/Rack";

export async function GET() {
    try {
        await connectDB();
        void Product;
        void Warehouse;
        void Rack;

        const user = await requireSessionUser();

        const staffWarehouseId = getUserWarehouseId(user);
        const filter =
            user.role === "STAFF" && staffWarehouseId
                ? { warehouseId: staffWarehouseId }
                : {};

        const inventory = await Inventory.find(filter)
            .populate("productId", "name sku price sellerName category")
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

        let status:
            | "AVAILABLE"
            | "LOW_STOCK"
            | "OUT_OF_STOCK";

        if (quantity === 0) {
            status = "OUT_OF_STOCK";
        } else if (quantity <= 10) {
            status = "LOW_STOCK";
        } else {
            status = "AVAILABLE";
        }

        const inventory = await Inventory.create({
            productId,
            warehouseId,
            rackId,
            quantity,
            status,
        });

        const populatedInventory = await Inventory.findById(
            inventory._id
        )
            .populate("productId", "name sku")
            .populate("warehouseId", "name code")
            .populate("rackId", "name code");

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
