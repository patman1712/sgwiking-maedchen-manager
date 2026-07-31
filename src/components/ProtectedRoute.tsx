import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppStore } from "@/store";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const currentUserId = useAppStore((state) => state.currentUserId);

  if (!currentUserId) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
