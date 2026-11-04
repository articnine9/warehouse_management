"use client";

import type { ReactNode } from "react";
import { useCanWrite } from "./AuthProvider";

export default function WriteAccess({ children }: { children: ReactNode }) {
  return useCanWrite() ? <>{children}</> : null;
}
