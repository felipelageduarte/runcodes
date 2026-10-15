import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const OfferingManagePage = lazy(() =>
  import("./OfferingManagePage").then((m) => ({ default: m.OfferingManagePage })),
);
const OfferingFormPage = lazy(() =>
  import("./OfferingFormPage").then((m) => ({ default: m.OfferingFormPage })),
);
const ExerciseFormPage = lazy(() =>
  import("./ExerciseFormPage").then((m) => ({ default: m.ExerciseFormPage })),
);
const ExerciseManagePage = lazy(() =>
  import("./ExerciseManagePage").then((m) => ({ default: m.ExerciseManagePage })),
);

// Autorização real é checada dentro de cada página (membership é por
// turma, não pelo `type` global da conta — ver @runcodes/shared/offeringRole.ts),
// então não tem RequireRole aqui.
export const teacherRoutes: RouteObject[] = [
  { path: "/turmas/nova", element: <OfferingFormPage mode="create" /> },
  { path: "/turmas/:id/editar", element: <OfferingFormPage mode="edit" /> },
  { path: "/turmas/:id/gerenciar", element: <OfferingManagePage /> },
  { path: "/turmas/:offeringId/exercicios/novo", element: <ExerciseFormPage mode="create" /> },
  { path: "/exercicios/:id/editar", element: <ExerciseFormPage mode="edit" /> },
  { path: "/exercicios/:id/gerenciar", element: <ExerciseManagePage /> },
];
