import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const DashboardPage = lazy(() =>
  import("./DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const OfferingPage = lazy(() => import("./OfferingPage").then((m) => ({ default: m.OfferingPage })));
const ExercisePage = lazy(() => import("./ExercisePage").then((m) => ({ default: m.ExercisePage })));
const ProfilePage = lazy(() => import("./ProfilePage").then((m) => ({ default: m.ProfilePage })));

export const studentRoutes: RouteObject[] = [
  { path: "/", element: <DashboardPage /> },
  { path: "/turmas/:id", element: <OfferingPage /> },
  { path: "/exercicios/:id", element: <ExercisePage /> },
  { path: "/perfil", element: <ProfilePage /> },
];
