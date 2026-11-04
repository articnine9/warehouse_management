import { NextRequest, NextResponse } from "next/server";
import { parseSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { canWrite } from "@/lib/permissions";
import User from "@/models/User";

/** Deny every data mutation for viewers, including calls made outside the UI. */
export async function proxy(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method) ||
      ["/api/auth/login", "/api/auth/logout"].includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const session = parseSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
  try {
    await connectDB();
    // Use the current account role, so changing a role takes effect immediately
    // even when the browser still has a cookie issued under the previous role.
    const user = await User.findById(session.userId).select("role status").lean();
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }
    if (!canWrite(user.role)) {
      return NextResponse.json({ success: false, message: "This account has view-only access. Changes are not permitted." }, { status: 403 });
    }
    return NextResponse.next();
  } catch {
    return NextResponse.json({ success: false, message: "Unable to verify account permissions" }, { status: 503 });
  }
}

export const config = { matcher: "/api/:path*" };
