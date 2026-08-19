import { useMemo, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppStore } from "@/store";
import { defaultRouteForRole } from "@/lib/utils";

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
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [users, currentUserId],
  );

  if (!currentUserId) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser?.requiresOnboarding && !allowPendingOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!currentUser?.requiresOnboarding && allowPendingOnboarding) {
    return <Navigate to={defaultRouteForRole(currentUser?.role)} replace />;
  }

  return <>{children}</>;
}
