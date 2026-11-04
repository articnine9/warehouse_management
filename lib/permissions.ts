export type UserRole = "ADMIN" | "STAFF" | "VIEWER";

export function canWrite(role?: string | null) {
  return role === "ADMIN" || role === "STAFF";
}

export function isUserRole(role: unknown): role is UserRole {
  return role === "ADMIN" || role === "STAFF" || role === "VIEWER";
}
