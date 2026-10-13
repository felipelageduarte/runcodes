import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { RequireRole } from "@runcodes/auth";
import { UserType } from "@runcodes/shared";

const MarketplacePage = lazy(() =>
  import("./MarketplacePage").then((m) => ({ default: m.MarketplacePage })),
);
const ExerciseDetailPage = lazy(() =>
  import("./ExerciseDetailPage").then((m) => ({ default: m.ExerciseDetailPage })),
);

export const marketplaceRoutes: RouteObject[] = [
  {
    path: "/marketplace",
    element: (
      <RequireRole minType={UserType.PROFESSOR}>
        <MarketplacePage />
      </RequireRole>
    ),
  },
  {
    path: "/marketplace/:id",
    element: (
      <RequireRole minType={UserType.PROFESSOR}>
        <ExerciseDetailPage />
      </RequireRole>
    ),
  },
];
