import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "./useSession";

function SessionCheckSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}

/** Route guard — redirects to /entrar when there's no session, preserving
 * the original destination so login can bounce back after success.
 * Waits for the session check to resolve first, so it never redirects
 * on the loading flicker before /me has answered. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) return <SessionCheckSplash />;
  if (!isAuthenticated) {
    return <Navigate to="/entrar" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

/** Hides a route from anyone below `minType` — same UX-only caveat as
 * everywhere else in the app: the real check is always the server's
 * (see docs/frontend/overview.md#padrões-de-código-e-princípios-de-design).
 * Redirects somewhere sane instead of rendering a dead end. */
export function RequireRole({ minType, children }: { minType: number; children: ReactNode }) {
  const { user, isLoading } = useSession();

  if (isLoading) return <SessionCheckSplash />;
  if (!user || user.type < minType) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
