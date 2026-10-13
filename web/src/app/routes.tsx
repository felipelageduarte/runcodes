import { Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import { RequireAuth } from "@runcodes/auth";
import { AppShell } from "./layout/AppShell";
import { RouteTransition } from "./RouteTransition";
import { authRoutes } from "../modules/auth/routes";
import { studentRoutes } from "../modules/student/routes";
import { teacherRoutes } from "../modules/teacher/routes";
import { marketplaceRoutes } from "../modules/marketplace/routes";
import { supportRoutes } from "../modules/support/routes";
import { adminRoutes } from "../modules/admin/routes";

function ProtectedLayout() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={null}>
          <RouteTransition>
            <Outlet />
          </RouteTransition>
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}

function AuthPageLayout() {
  return (
    <Suspense fallback={null}>
      <RouteTransition>
        <Outlet />
      </RouteTransition>
    </Suspense>
  );
}

// Único lugar que conhece todos os módulos — cada um só expõe seu
// array de RouteObject, nunca componentes internos (ver
// docs/frontend/overview.md#estrutura-de-pastas-monorepo-single-app).
export const router = createBrowserRouter([
  { element: <AuthPageLayout />, children: authRoutes },
  {
    element: <ProtectedLayout />,
    children: [...studentRoutes, ...teacherRoutes, ...marketplaceRoutes, ...supportRoutes, ...adminRoutes],
  },
]);
