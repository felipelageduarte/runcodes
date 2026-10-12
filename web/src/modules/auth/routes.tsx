import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const LoginPage = lazy(() => import("./LoginPage").then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import("./SignupPage").then((m) => ({ default: m.SignupPage })));
const ConfirmEmailPage = lazy(() =>
  import("./ConfirmEmailPage").then((m) => ({ default: m.ConfirmEmailPage })),
);
const ResendConfirmationPage = lazy(() =>
  import("./ResendConfirmationPage").then((m) => ({ default: m.ResendConfirmationPage })),
);
const RequestPasswordResetPage = lazy(() =>
  import("./RequestPasswordResetPage").then((m) => ({ default: m.RequestPasswordResetPage })),
);
const ResetPasswordPage = lazy(() =>
  import("./ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);

// Único contrato que o shell conhece deste módulo — ver
// docs/frontend/overview.md#estrutura-de-pastas-monorepo-single-app.
export const authRoutes: RouteObject[] = [
  { path: "/entrar", element: <LoginPage /> },
  { path: "/cadastro", element: <SignupPage /> },
  { path: "/confirmar-email", element: <ConfirmEmailPage /> },
  { path: "/reenviar-confirmacao", element: <ResendConfirmationPage /> },
  { path: "/esqueci-senha", element: <RequestPasswordResetPage /> },
  { path: "/redefinir-senha", element: <ResetPasswordPage /> },
];
