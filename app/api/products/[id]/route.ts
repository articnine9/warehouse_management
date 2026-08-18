import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Product from "@/models/Product";
import ProductHistory from "@/models/ProductHistory";

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
        { success: false, message: "Only admin can update products" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const oldProduct = await Product.findById(id).lean();
    if (!oldProduct) {
      return Response.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    const oldValues = oldProduct as unknown as Record<string, unknown>;
    const changedFields = Object.keys(body).filter((key) => {
      const oldVal = oldValues[key];
      const newVal = body[key];
      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    });

    const product = await Product.findByIdAndUpdate(
      id,
      {
        name: body.name,
        sku: body.sku,
        category: body.category,
        categoryId: body.categoryId,
        sellerName: body.sellerName,
        price: Number(body.price),
        description: body.description,
        status: body.status,
      },
      { new: true }
    ).populate("categoryId", "name code");

    if (!product) {
      return Response.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    if (changedFields.length > 0) {
      await ProductHistory.create({
        productId: product._id,
        action: "UPDATED",
        changedBy: user.id,
        changedFields,
        oldValues: oldValues as Record<string, unknown>,
        newValues: body as Record<string, unknown>,
      });
    }

    return Response.json({ success: true, data: product });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("PUT product error:", error);

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
        message: "Failed to update product",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const user = await requireSessionUser();

    if (user.role !== "ADMIN") {
      return Response.json(
        { success: false, message: "Only admin can delete products" },
        { status: 403 }
      );
    }

    const product = await Product.findById(id).lean();

    if (!product) {
      return Response.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    const productObj = product as unknown as Record<string, unknown>;

    await Product.findByIdAndDelete(id);

    await ProductHistory.create({
      productId: product._id,
      action: "DELETED",
      changedBy: user.id,
      oldValues: productObj,
    });

    return Response.json({ success: true, message: "Product deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error("DELETE product error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to delete product",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
