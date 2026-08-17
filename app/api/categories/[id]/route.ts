import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Category from "@/models/Category";

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
        { success: false, message: "Only admin can update categories" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const category = await Category.findByIdAndUpdate(
      id,
      {
        name: body.name?.trim(),
        code: body.code?.trim().toUpperCase(),
        description: body.description?.trim(),
        status: body.status,
      },
      { new: true }
    );

    if (!category) {
      return Response.json(
        { success: false, message: "Category not found" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: category });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("PUT category error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to update category",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only admin can delete categories" },
        { status: 403 }
      );
    }

    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return Response.json(
        { success: false, message: "Category not found" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, message: "Category deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("DELETE category error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to delete category",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
