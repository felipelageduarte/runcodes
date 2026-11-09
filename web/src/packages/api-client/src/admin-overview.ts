import type { DbHealth } from "./db-admin";
import { apiFetch } from "./http";

export interface UserTypeCount {
  type: number;
  count: number;
}

export type OverviewDatabase = { ok: true; health: DbHealth } | { ok: false; error: string };

/** Espelha AdminOverview em runcodes-api (services/admin-overview.service.ts). */
export interface AdminOverview {
  usersByType: UserTypeCount[];
  /** Commits em IN_QUEUE, ainda não pegos pelo compilador. */
  commitsQueued: number;
  /** Commits em COMPILING/RUNNING há mais de `stuckMinutes`. */
  commitsStuck: number;
  compilationErrors24h: number;
  serverErrors24h: number;
  ticketsOpen: number;
  alertsActive: number;
  stuckMinutes: number;
  database: OverviewDatabase;
  /** Momento da leitura — o backend cacheia 30 s. */
  generatedAt: string;
}

export const DEFAULT_STUCK_MINUTES = 15;

/** GET /api/admin/overview — KPIs da home do admin (admin+). Uma
 * consulta agregada, cacheada 30 s no servidor; `stuckMinutes` muda a
 * janela do contador de commits presos (1 a 1440). */
export function getAdminOverview(stuckMinutes: number = DEFAULT_STUCK_MINUTES): Promise<AdminOverview> {
  return apiFetch(`/admin/overview?stuckMinutes=${stuckMinutes}`);
}
