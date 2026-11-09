import { UserType } from "./userType";

/**
 * Cópia do catálogo `recurso:ação` → nível mínimo de `UserType` da API
 * (`api/src/http/admin-permissions.ts`), que é a fonte de verdade. O menu
 * (`app/navigation.ts`) lê daqui para mostrar só o que o papel pode abrir.
 * O teste de contrato na API (`admin-permissions.contract.test.ts`) falha
 * se as duas cópias divergirem. Autorização de verdade é sempre a do
 * servidor (ver docs/admin/frontend/security.md).
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

export function hasPermission(userType: number | undefined, permission: AdminPermission): boolean {
  return (userType ?? -1) >= ADMIN_PERMISSIONS[permission];
}
