import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppStore } from "@/store";

interface ProtectedRouteProps {
  children: ReactNode;
  allowPendingOnboarding?: boolean;
}

export default function ProtectedRoute({
  children,
  allowPendingOnboarding = false,
}: ProtectedRouteProps) {
  const currentUserId = useAppStore((state) => state.currentUserId);
  const users = useAppStore((state) => state.users);
  const currentUser = users.find((user) => user.id === currentUserId) ?? null;

  if (!currentUserId) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser?.requiresOnboarding && !allowPendingOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!currentUser?.requiresOnboarding && allowPendingOnboarding) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
