import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useMarketStore } from "@/lib/store";

export function RequireAuth() {
  const user = useMarketStore((s) => s.user);
  return user ? <Outlet /> : <Navigate to="/about" replace />;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const user = useMarketStore((s) => s.user);
  if (user) return <Navigate to={user.school_year ? "/" : "/setup"} replace />;
  return <>{children}</>;
}

/** Hides the admin panel from non-admins. The backend enforces the same rule
 * on every /admin request, so a tampered local user object only gets as far
 * as a dashboard full of 403s. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const user = useMarketStore((s) => s.user);
  if (!user?.is_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
