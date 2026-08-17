import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Product from "@/models/Product";

export async function GET(request: Request) {
  try {
    await connectDB();
    await requireSessionUser();

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("query");

    // If search query is provided, filter by name or sku
    const filter: {
      $or?: Array<
        | { name: { $regex: string; $options: string } }
        | { sku: { $regex: string; $options: string } }
      >;
    } = {};
    if (query?.trim()) {
      filter.$or = [
        { name: { $regex: query.trim(), $options: "i" } },
        { sku: { $regex: query.trim(), $options: "i" } },
      ];
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
      sellerName: body.sellerName,
      price: Number(body.price),
      description: body.description,
      status: body.status ?? "ACTIVE",
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
