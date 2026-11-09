import type { NextFunction, RequestHandler, Response } from "express";
import type { AuthedRequest } from "./requireAuth.js";
import { ADMIN_PERMISSIONS, type AdminPermission } from "../admin-permissions.js";

export const PERMISSION_MARKER = Symbol.for("runcodes.permission");

export type PermissionHandler = RequestHandler & { [PERMISSION_MARKER]?: AdminPermission };

/** Gate por permissão do catálogo (`admin-permissions.ts`). Substitui o
 * antigo `requireMinType(n)`: a rota declara o que precisa, o catálogo diz
 * qual nível basta, e o teste estrutural consegue listar o que está
 * protegido porque o handler carrega a chave em `PERMISSION_MARKER`.
 * Deve rodar depois de `requireAuth`. */
export function requirePermission(permission: AdminPermission): PermissionHandler {
  if (!(permission in ADMIN_PERMISSIONS)) {
    throw new Error(`permission "${permission}" is not in ADMIN_PERMISSIONS`);
  }
  const minType = ADMIN_PERMISSIONS[permission];
  const handler: PermissionHandler = (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "missing_token" });
    if (req.user.type < minType) return res.status(403).json({ error: "forbidden" });
    next();
  };
  handler[PERMISSION_MARKER] = permission;
  return handler;
}

export function permissionOf(handler: unknown): AdminPermission | undefined {
  return typeof handler === "function" ? (handler as PermissionHandler)[PERMISSION_MARKER] : undefined;
}
