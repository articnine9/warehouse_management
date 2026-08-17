import { connectDB } from "@/lib/mongodb";
import { getSessionUser, toSafeUser } from "@/lib/auth";

export async function GET() {
  try {
    await connectDB();

    const user = await getSessionUser();

    if (!user) {
      return Response.json(
        {
          success: false,
          message: "Not authenticated",
        },
        { status: 401 }
      );
    }

    return Response.json({
      success: true,
      data: toSafeUser(user),
    });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to fetch current user",
      },
      { status: 500 }
    );
  }
}
