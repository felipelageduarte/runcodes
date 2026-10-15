import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const SupportPage = lazy(() => import("./SupportPage").then((m) => ({ default: m.SupportPage })));

export const supportRoutes: RouteObject[] = [{ path: "/suporte", element: <SupportPage /> }];
