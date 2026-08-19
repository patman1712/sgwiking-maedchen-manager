import { Navigate } from "react-router-dom";
import { useAppStore } from "@/store";
import { useMemo } from "react";
import { defaultRouteForRole } from "@/lib/utils";

export default function Home() {
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const user = useMemo(
    () => users.find((u) => u.id === currentUserId) ?? null,
    [users, currentUserId],
  );
  return <Navigate to={defaultRouteForRole(user?.role)} replace />;
}
