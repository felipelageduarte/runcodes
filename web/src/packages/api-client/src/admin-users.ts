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

/** Só name/type/confirmed/universityId — resetar senha é o próprio
 * usuário via /esqueci-senha, não uma ação de admin. */
export function updateAdminUser(email: string, patch: AdminUserPatch): Promise<AdminUserRecord> {
  return apiFetch(`/admin/users/${encodeURIComponent(email)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export interface NewAdminUserInput {
  email: string;
  name: string;
  password: string;
  type: number;
  universityId: number | null;
}

/** Cria conta já confirmada (sem round-trip de confirmação por email) —
 * mirrors UsersController::insert(). */
export function createAdminUser(input: NewAdminUserInput): Promise<AdminUserRecord> {
  return apiFetch("/admin/users", { method: "POST", body: JSON.stringify(input) });
}

/** Hard delete — sem como desfazer. Exige a senha do admin autenticado
 * como reautenticação (mirrors PUT /users/me/password). */
export function deleteAdminUser(email: string, adminPassword: string): Promise<void> {
  return apiFetch(`/admin/users/${encodeURIComponent(email)}`, {
    method: "DELETE",
    body: JSON.stringify({ password: adminPassword }),
  });
}

export interface PlatformActivity {
  today: number;
  yesterday: number;
  last7Days: number;
  dailyTrend: { date: string; total: number }[];
}

/** Volume de submissões da plataforma inteira (não por turma/exercício)
 * — mirrors StatsController::commitsInfographic()/commitsChart(). */
export function getPlatformActivity(): Promise<PlatformActivity> {
  return apiFetch("/admin/stats/activity");
}
