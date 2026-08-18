import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import ProductHistory from "@/models/ProductHistory";

export async function GET(request: Request) {
  try {
    await connectDB();
    await requireSessionUser();

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const action = searchParams.get("action");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    // Build filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (productId) {
      filter.productId = productId;
    }

    if (action) {
      filter.action = action;
    }

    const page = Math.max(1, parseInt(pageParam || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(limitParam || "50", 10)));
    const skip = (page - 1) * limit;

    const [total, history] = await Promise.all([
      ProductHistory.countDocuments(filter),
      ProductHistory.find(filter)
        .populate("changedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return Response.json({
      success: true,
      data: history,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
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

    console.error("GET /api/product-history error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to fetch product history",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
