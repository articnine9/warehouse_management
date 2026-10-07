import { connectDB } from "@/lib/mongodb";
import { hashPassword, setSessionCookie, toSafeUser } from "@/lib/auth";
import User from "@/models/User";
import Warehouse from "@/models/Warehouse";

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();
    const role = "STAFF";
    const warehouseIds = Array.isArray(body.warehouseIds)
      ? body.warehouseIds.map((id: string) => id.trim()).filter(Boolean)
      : body.warehouseId
        ? [body.warehouseId.trim()]
        : [];

    if (!name || !email || !password) {
      return Response.json(
        {
          success: false,
          message: "Name, email, and password are required",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return Response.json(
        {
          success: false,
          message: "Password must be at least 6 characters",
        },
        { status: 400 }
      );
    }

    if (warehouseIds.length === 0) {
      return Response.json(
        {
          success: false,
          message: "Please choose at least one warehouse for staff",
        },
        { status: 400 }
      );
    }

    const warehouses = await Warehouse.find({ _id: { $in: warehouseIds } });

    if (warehouses.length !== warehouseIds.length) {
      return Response.json(
        {
          success: false,
          message: "One or more selected warehouses do not exist",
        },
        { status: 404 }
      );
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return Response.json(
        {
          success: false,
          message: "An account with this email already exists",
        },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      warehouseIds,
      status: "ACTIVE",
      lastLoginAt: new Date(),
    });

    const populatedUser = await User.findById(user._id)
      .select("-passwordHash")
      .populate("warehouseIds", "name code");

    await setSessionCookie(user._id.toString(), role);

    return Response.json({
      success: true,
      data: toSafeUser(populatedUser!),
    });
  } catch (error) {
    console.error("POST /api/auth/register error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to register user",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
