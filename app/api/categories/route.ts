import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Category from "@/models/Category";

export async function GET() {
  try {
    await connectDB();

    const categories = await Category.find().sort({
      name: 1,
    });

    return Response.json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    console.error("GET categories error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to fetch categories",
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
          message: "Only admin can add categories",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.name || !body.code) {
      return Response.json(
        {
          success: false,
          message: "Category name and code are required",
        },
        { status: 400 }
      );
    }

    const existing = await Category.findOne({ code: body.code.toUpperCase().trim() });
    if (existing) {
      return Response.json(
        {
          success: false,
          message: "A category with this code already exists",
        },
        { status: 400 }
      );
    }

    const category = await Category.create({
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      description: body.description?.trim() || "",
      status: body.status ?? "ACTIVE",
    });

    return Response.json(
      {
        success: true,
        data: category,
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

    console.error("POST category error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to create category",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
