/**
 * A route guard. Renders its children only for a signed-in user whose role is
 * allowed, and otherwise sends them to the login page.
 *
 * This is convenience, not security. The API decides what anyone may see, and
 * a student asking for a review queue gets a 404 from the server whatever this
 * component does. Hiding a link is not the same as refusing a request.
 */
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "./AuthProvider";
import type { Role } from "../api/types";

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();

  // Waiting matters: without it the first render has no user yet and would
  // bounce a signed-in person straight back to the login page.
  if (loading) return <p className="muted">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
