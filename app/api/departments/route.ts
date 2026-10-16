import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Department from "@/models/Department";

const INITIAL_DEPARTMENTS = [
  { name: "Operations", code: "OPS", description: "Warehouse operations and dispatch" },
  { name: "Inventory", code: "INV", description: "Inventory audit and cataloging" },
  { name: "Electrical", code: "ELEC", description: "Electrical tools and repairs" },
  { name: "Maintenance", code: "MAINT", description: "General facility and equipment maintenance" },
  { name: "Logistics", code: "LOG", description: "Fleet and delivery management" },
  { name: "Safety", code: "SAF", description: "Safety equipment and compliance" },
  { name: "IT & Systems", code: "IT", description: "Hardware, IT devices and systems" },
  { name: "Quality Assurance", code: "QA", description: "Quality inspection and standards" },
  { name: "Administration", code: "ADM", description: "Corporate and administrative workforce" },
];

export async function GET() {
  try {
    await connectDB();

    let departments = await Department.find().sort({ name: 1 });

    // Seed default departments if collection is empty
    if (!departments || departments.length === 0) {
      await Department.insertMany(INITIAL_DEPARTMENTS);
      departments = await Department.find().sort({ name: 1 });
    }

    return Response.json({
      success: true,
      data: departments,
      count: departments.length,
    });
  } catch (error) {
    console.error("GET /api/departments error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to fetch departments",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    await requireSessionUser();

    const body = await request.json();
    const name = String(body.name || "").trim();
    let code = String(body.code || "").trim().toUpperCase();
    const description = String(body.description || "").trim();

    if (!name) {
      return Response.json(
        { success: false, message: "Department name is required" },
        { status: 400 }
      );
    }

    // Auto-generate code from name if not provided
    if (!code) {
      code = name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 5);
      if (!code) code = name.slice(0, 3).toUpperCase();
    }

    // Check for duplicate name
    const existing = await Department.findOne({
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });

    if (existing) {
      return Response.json(
        { success: false, message: `Department "${existing.name}" already exists` },
        { status: 400 }
      );
    }

    const newDept = await Department.create({
      name,
      code,
      description: description || undefined,
      status: "ACTIVE",
    });

    return Response.json(
      {
        success: true,
        message: "Department created successfully",
        data: newDept,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/departments error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to create department",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
