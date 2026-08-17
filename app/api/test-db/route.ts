import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({
      success: true,
      message: "Database connected successfully!",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed",
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
