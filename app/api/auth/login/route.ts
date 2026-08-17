import { connectDB } from "@/lib/mongodb";
import {
  setSessionCookie,
  toSafeUser,
  verifyPassword,
} from "@/lib/auth";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!email || !password) {
      return Response.json(
        {
          success: false,
          message: "Email and password are required",
        },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email }).populate(
      "warehouseId",
      "name code"
    );

    if (!user) {
      return Response.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    const passwordMatches = await verifyPassword(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return Response.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return Response.json(
        {
          success: false,
          message: "This account is inactive",
        },
        { status: 403 }
      );
    }

    user.lastLoginAt = new Date();
    await user.save();

    await setSessionCookie(user._id.toString(), user.role);

    return Response.json({
      success: true,
      data: toSafeUser(user),
    });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to log in",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
