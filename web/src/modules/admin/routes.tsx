import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { RequireRole } from "@runcodes/auth";
import { UserType } from "@runcodes/shared";

const AdminPage = lazy(() => import("./AdminPage").then((m) => ({ default: m.AdminPage })));
const UniversitiesTab = lazy(() => import("./components/UniversitiesTab").then((m) => ({ default: m.UniversitiesTab })));
const CoursesTab = lazy(() => import("./components/CoursesTab").then((m) => ({ default: m.CoursesTab })));
const AllowedFilesTab = lazy(() => import("./components/AllowedFilesTab").then((m) => ({ default: m.AllowedFilesTab })));
const AdminUsersTab = lazy(() => import("./components/AdminUsersTab").then((m) => ({ default: m.AdminUsersTab })));
const LogsTab = lazy(() => import("./components/LogsTab").then((m) => ({ default: m.LogsTab })));
const BroadcastTab = lazy(() => import("./components/BroadcastTab").then((m) => ({ default: m.BroadcastTab })));
const PipelineTab = lazy(() => import("./components/PipelineTab").then((m) => ({ default: m.PipelineTab })));
const DatabaseTab = lazy(() => import("./components/DatabaseTab").then((m) => ({ default: m.DatabaseTab })));

export const adminRoutes: RouteObject[] = [
  {
    path: "/admin",
    element: (
      <RequireRole minType={UserType.ADMIN}>
        <AdminPage />
      </RequireRole>
    ),
    children: [
      { index: true, element: <Navigate to="universidades" replace /> },
      { path: "universidades", element: <UniversitiesTab /> },
      { path: "cursos", element: <CoursesTab /> },
      { path: "arquivos", element: <AllowedFilesTab /> },
      { path: "usuarios", element: <AdminUsersTab /> },
      { path: "logs", element: <LogsTab /> },
      { path: "mensagens", element: <BroadcastTab /> },
      { path: "pipeline", element: <PipelineTab /> },
      { path: "banco", element: <DatabaseTab /> },
    ],
  },
];
