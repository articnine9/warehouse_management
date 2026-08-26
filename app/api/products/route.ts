import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Product from "@/models/Product";
import ProductHistory from "@/models/ProductHistory";

export async function GET(request: Request) {
  try {
    await connectDB();
    await requireSessionUser();

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("query") || searchParams.get("search");
    const categoryParam = searchParams.get("category");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    // Build filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (categoryParam && categoryParam !== "ALL") {
      filter.category = categoryParam;
    }

    if (query?.trim()) {
      const regex = { $regex: query.trim(), $options: "i" };
      filter.$or = [
        { name: regex },
        { sku: regex },
        { sellerName: regex },
        { category: regex },
      ];
    }

    if (pageParam || limitParam) {
      const page = Math.max(1, parseInt(pageParam || "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(limitParam || "10", 10)));
      const skip = (page - 1) * limit;

      const [total, products] = await Promise.all([
        Product.countDocuments(filter),
        Product.find(filter)
          .populate("categoryId", "name code")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

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

    const products = await Product.find(filter)
      .populate("categoryId", "name code")
      .sort({
        createdAt: -1,
      });

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

    if (user.role !== "ADMIN") {
      return Response.json(
        {
          success: false,
          message: "Only admin can add products",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const product = await Product.create({
      name: body.name,
      sku: body.sku,
      category: body.category,
      categoryId: body.categoryId,
      productType: body.productType === "REUSABLE" ? "REUSABLE" : "NON_REUSABLE",
      returnDays: body.productType === "REUSABLE" ? Math.max(1, Number(body.returnDays) || 30) : 0,
      serviceIntervalMonths: body.serviceIntervalMonths !== undefined ? Number(body.serviceIntervalMonths) : 3,
      warrantyMonths: body.warrantyMonths !== undefined ? Number(body.warrantyMonths) : 12,
      serialNumber: body.serialNumber ? String(body.serialNumber).trim() : undefined,
      sellerName: body.sellerName,
      price: Number(body.price),
      description: body.description,
      status: body.status ?? "ACTIVE",
    });

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
