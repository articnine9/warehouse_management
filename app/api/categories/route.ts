import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Category from "@/models/Category";
import Product from "@/models/Product";

function escapeRegex(text: string) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export async function GET() {
  try {
    await connectDB();

    const categories = await Category.find().sort({
      name: 1,
    }).lean();

    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({
          $or: [
            { categoryId: cat._id },
            { category: cat.name },
            { category: { $regex: `^${escapeRegex(cat.name)}$`, $options: "i" } },
          ],
        });
        return {
          ...cat,
          productCount: count,
        };
      })
    );

    return Response.json({
      success: true,
      data: categoriesWithCounts,
      count: categoriesWithCounts.length,
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

    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      return Response.json(
        {
          success: false,
          message: "Unauthorized to add categories",
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
