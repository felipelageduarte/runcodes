import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { RequireRole } from "@runcodes/auth";
import { UserType } from "@runcodes/shared";

const AdminPage = lazy(() => import("./AdminPage").then((m) => ({ default: m.AdminPage })));

export const adminRoutes: RouteObject[] = [
  {
    path: "/admin",
    element: (
      <RequireRole minType={UserType.ADMIN}>
        <AdminPage />
      </RequireRole>
    ),
  },
];
