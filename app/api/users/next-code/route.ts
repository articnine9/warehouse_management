import { connectDB } from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/auth";
import Employee from "@/models/Employee";

export async function GET() {
  try {
    await connectDB();
    await requireSessionUser();

    const employees = await Employee.find({}, "employeeCode").lean();
    let maxNum = 0;
    for (const emp of employees) {
      const match = emp.employeeCode?.match(/^(?:USR|EMP)(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextCode = `USR${String(maxNum + 1).padStart(3, "0")}`;

    return Response.json({
      success: true,
      nextCode,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    return Response.json(
      { success: false, nextCode: "USR001" },
      { status: 500 }
    );
  }
}
