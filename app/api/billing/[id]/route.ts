import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Invoice from "@/models/Invoice";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return Response.json(
        {
          success: false,
          message: "Invoice not found",
        },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error("GET /api/billing/[id] error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to fetch invoice",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
