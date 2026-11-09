import type { AdminOverviewRepository, OverviewSnapshot } from "../repositories/admin-overview.repository.js";
import type { DbHealth } from "../repositories/db-admin.repository.js";
import type { DbAdminService } from "./db-admin.service.js";

export const DEFAULT_STUCK_MINUTES = 15;
export const OVERVIEW_CACHE_TTL_MS = 30_000;

export type OverviewDatabase =
  | { ok: true; health: DbHealth }
  | { ok: false; error: string };

export interface AdminOverview extends OverviewSnapshot {
  stuckMinutes: number;
  database: OverviewDatabase;
  /** Quando a leitura foi feita — com o cache de 30 s, a tela mostra
   * "atualizado há X s" em vez de fingir que é tempo real. */
  generatedAt: string;
}

interface CacheEntry {
  expiresAt: number;
  value: AdminOverview;
}

/** KPIs da home do admin (spec admin-e-separacao-front, F4). Uma
 * consulta agregada + a saúde do banco já exposta em /admin/db/health,
 * cacheadas por 30 s por valor de N: dez admins com a aba aberta não
 * viram dez varreduras de `commits` por refetch. A saúde do banco
 * falhar (pg_stat_activity indisponível, por exemplo) não derruba os
 * contadores: vira `database.ok = false` na mesma resposta. */
export class AdminOverviewService {
  private readonly cache = new Map<number, CacheEntry>();

  constructor(
    private readonly overview: AdminOverviewRepository,
    private readonly dbAdmin: Pick<DbAdminService, "health">,
    private readonly ttlMs: number = OVERVIEW_CACHE_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async get(stuckMinutes: number = DEFAULT_STUCK_MINUTES): Promise<AdminOverview> {
    const cached = this.cache.get(stuckMinutes);
    const at = this.now();
    if (cached && cached.expiresAt > at) return cached.value;

    const [snapshot, database] = await Promise.all([
      this.overview.snapshot(stuckMinutes),
      this.readDatabaseHealth(),
    ]);

    const value: AdminOverview = {
      ...snapshot,
      stuckMinutes,
      database,
      generatedAt: new Date(at).toISOString(),
    };
    this.cache.set(stuckMinutes, { expiresAt: at + this.ttlMs, value });
    return value;
  }

  /** Esvazia o cache — para testes e para quando uma ação do admin
   * (fechar ticket, apagar aviso) quiser refletir no painel na hora. */
  invalidate() {
    this.cache.clear();
  }

  private async readDatabaseHealth(): Promise<OverviewDatabase> {
    try {
      return { ok: true, health: await this.dbAdmin.health() };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "db_health_failed" };
    }
  }
}
