import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useMarketStore } from "@/lib/store";

export function RequireAuth() {
  const user = useMarketStore((s) => s.user);
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const user = useMarketStore((s) => s.user);
  if (user) return <Navigate to={user.school_year ? "/" : "/setup"} replace />;
  return <>{children}</>;
}
