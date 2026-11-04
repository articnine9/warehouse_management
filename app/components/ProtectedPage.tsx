"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

type ProtectedPageProps = {
  children: ReactNode;
  allowedRoles?: Array<"ADMIN" | "STAFF" | "VIEWER">;
};

export default function ProtectedPage({
  children,
  allowedRoles,
}: ProtectedPageProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace("/");
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [allowedRoles, loading, router, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-2xl bg-white px-6 py-4 text-sm font-medium text-gray-600 shadow-sm">
          Loading account...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>
    {user.role === "VIEWER" && <div role="status" className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-800 print:hidden">View-only access · All warehouses</div>}
    {children}
  </>;
}
