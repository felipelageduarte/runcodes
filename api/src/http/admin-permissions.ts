import { UserType } from "../lib/constants.js";

/**
 * Catálogo de permissões `recurso:ação` → nível mínimo de `UserType`
 * (spec admin-e-separacao-front, F2/G3, decisão Q2: catálogo no código, sem
 * matriz editável). É a única fonte de verdade do gate das rotas
 * administrativas: `requirePermission(chave)` lê daqui, e o teste
 * estrutural (`admin-permissions.test.ts`) falha se uma rota sob
 * `/api/admin*` for montada sem uma permissão deste catálogo.
 *
 * Cópia espelhada em `web/src/packages/shared/src/adminPermissions.ts`
 * (o menu lê de lá); o teste de contrato compara as duas.
 */
export const ADMIN_PERMISSIONS = {
  "admin.users:manage": UserType.ADMIN,
  "admin.stats:read": UserType.ADMIN,
  "admin.logs:read": UserType.ADMIN,
  "admin.audit:read": UserType.ADMIN,
  "admin.pipeline:manage": UserType.ADMIN,
  "admin.db:query": UserType.ADMIN,
  "admin.overview:read": UserType.ADMIN,
  "admin.docs:read": UserType.ADMIN,
  "admin.universities:manage": UserType.ADMIN,
  "admin.courses:manage": UserType.ADMIN,
  "admin.exercises:read": UserType.ADMIN,
  "admin.allowed-files:manage": UserType.ADMIN,
  "admin.questions:manage": UserType.ADMIN,
  "admin.messages:manage": UserType.ADMIN,
  "offerings:create": UserType.PROFESSOR,
  "courses:search": UserType.PROFESSOR,
} as const;

export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;

export function minTypeFor(permission: AdminPermission): number {
  return ADMIN_PERMISSIONS[permission];
}
