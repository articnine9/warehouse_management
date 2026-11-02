import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Category from "@/models/Category";
import Product from "@/models/Product";
import StockMovement from "@/models/StockMovement";

function escapeRegex(text: string) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const user = await requireSessionUser();

    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      return Response.json(
        { success: false, message: "Unauthorized to update categories" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const existingCategory = await Category.findById(id);
    if (!existingCategory) {
      return Response.json(
        { success: false, message: "Category not found" },
        { status: 404 }
      );
    }

    const oldName = existingCategory.name;
    const newName = body.name?.trim();
    const newCode = body.code?.trim().toUpperCase();

    if (newName && newName !== oldName) {
      const duplicate = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: `^${escapeRegex(newName)}$`, $options: "i" },
      });
      if (duplicate) {
        return Response.json(
          { success: false, message: `A category named "${newName}" already exists` },
          { status: 400 }
        );
      }
    }

    if (newName) existingCategory.name = newName;
    if (newCode) existingCategory.code = newCode;
    if (body.description !== undefined) existingCategory.description = body.description?.trim();
    if (body.status !== undefined) existingCategory.status = body.status;

    await existingCategory.save();

    // If category name was renamed, cascade update to all linked products & stock movements
    if (newName && newName !== oldName) {
      await Product.updateMany(
        {
          $or: [
            { categoryId: existingCategory._id },
            { category: oldName },
            { category: { $regex: `^${escapeRegex(oldName)}$`, $options: "i" } },
          ],
        },
        {
          $set: {
            category: newName,
            categoryId: existingCategory._id,
          },
        }
      );

      await StockMovement.updateMany(
        {
          $or: [
            { category: oldName },
            { category: { $regex: `^${escapeRegex(oldName)}$`, $options: "i" } },
          ],
        },
        {
          $set: {
            category: newName,
          },
        }
      );
    }

    return Response.json({ success: true, data: existingCategory });
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

    const category = await Category.findById(id);

    if (!category) {
      return Response.json(
        { success: false, message: "Category not found" },
        { status: 404 }
      );
    }

    // Safety guard: Prevent deleting categories that still have products
    const productCount = await Product.countDocuments({
      $or: [
        { categoryId: id },
        { category: category.name },
        { category: { $regex: `^${escapeRegex(category.name)}$`, $options: "i" } },
      ],
    });

    if (productCount > 0) {
      return Response.json(
        {
          success: false,
          message: `Cannot delete category "${category.name}" because it still contains ${productCount} product(s). Please reassign them first.`,
        },
        { status: 400 }
      );
    }

    await Category.findByIdAndDelete(id);

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
