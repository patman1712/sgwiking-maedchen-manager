import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { UserRole } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const defaultRouteForRole = (role?: UserRole | null): string => {
  if (role === "social") {
    return "/dashboard/social-media"
  }
  return "/dashboard"
}
