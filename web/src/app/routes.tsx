import { Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import { RequireAuth } from "@runcodes/auth";
import { AppShell } from "./layout/AppShell";
import { authRoutes } from "../modules/auth/routes";
import { studentRoutes } from "../modules/student/routes";
import { marketplaceRoutes } from "../modules/marketplace/routes";
import { adminRoutes } from "../modules/admin/routes";

function ProtectedLayout() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}

// Único lugar que conhece todos os módulos — cada um só expõe seu
// array de RouteObject, nunca componentes internos (ver
// docs/frontend/overview.md#estrutura-de-pastas-monorepo-single-app).
export const router = createBrowserRouter([
  ...authRoutes.map((route) => ({
    ...route,
    element: <Suspense fallback={null}>{route.element}</Suspense>,
  })),
  {
    element: <ProtectedLayout />,
    children: [...studentRoutes, ...marketplaceRoutes, ...adminRoutes],
  },
]);
