import { apiFetch } from "./http";

export interface AdminUserRecord {
  email: string;
  name: string;
  type: number;
  universityId: number | null;
  confirmed: boolean;
  identifier: string | null;
}

export interface AdminUserListFilter {
  universityId?: number;
  type?: number;
  confirmed?: boolean;
  name?: string;
  email?: string;
  page?: number;
  pageSize?: number;
}

export function listAdminUsers(
  filter: AdminUserListFilter = {},
): Promise<{ total: number; page: number; pageSize: number; users: AdminUserRecord[] }> {
  const qs = new URLSearchParams();
  if (filter.universityId !== undefined) qs.set("universityId", String(filter.universityId));
  if (filter.type !== undefined) qs.set("type", String(filter.type));
  if (filter.confirmed !== undefined) qs.set("confirmed", String(filter.confirmed));
  if (filter.name) qs.set("name", filter.name);
  if (filter.email) qs.set("email", filter.email);
  qs.set("page", String(filter.page ?? 1));
  qs.set("pageSize", String(filter.pageSize ?? 20));
  return apiFetch(`/admin/users?${qs.toString()}`);
}

export function getAdminUser(email: string): Promise<AdminUserRecord> {
  return apiFetch(`/admin/users/${encodeURIComponent(email)}`);
}

export interface AdminUserPatch {
  name?: string;
  type?: number;
  confirmed?: boolean;
  universityId?: number | null;
}

/** Não dá pra resetar senha nem desabilitar/banir conta por aqui — o
 * backend não expõe isso hoje (gap documentado, não implementado nesta
 * fase). Só name/type/confirmed/universityId. */
export function updateAdminUser(email: string, patch: AdminUserPatch): Promise<AdminUserRecord> {
  return apiFetch(`/admin/users/${encodeURIComponent(email)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}
