import { Prisma, type PrismaClient } from "@prisma/client";
import { CommitStatus } from "../lib/constants.js";

export interface UserTypeCount {
  type: number;
  count: number;
}

/** Contadores crus do painel admin — o que uma única consulta ao banco
 * devolve. Sem derivação aqui; quem monta a resposta é o serviço. */
export interface OverviewSnapshot {
  usersByType: UserTypeCount[];
  /** Commits em IN_QUEUE: ainda não pegos pelo runcodes-compiler. */
  commitsQueued: number;
  /** Commits em COMPILING/RUNNING há mais de `stuckMinutes` — o worker
   * pegou e não terminou; sinal de container travado. */
  commitsStuck: number;
  /** Commits com erro de compilação (status ERROR) nas últimas 24 h. */
  compilationErrors24h: number;
  /** Commits com falha do próprio pipeline (SERVER_ERROR) nas últimas 24 h. */
  serverErrors24h: number;
  ticketsOpen: number;
  /** Avisos com `valid >= hoje` — mesma regra do AlertRepository.listActive. */
  alertsActive: number;
}

export interface AdminOverviewRepository {
  snapshot(stuckMinutes: number): Promise<OverviewSnapshot>;
}

interface SnapshotRow {
  users_by_type: { type: number; count: number }[] | null;
  commits_queued: bigint;
  commits_stuck: bigint;
  compilation_errors_24h: bigint;
  server_errors_24h: bigint;
  tickets_open: bigint;
  alerts_active: bigint;
}

/** Uma ida só ao Postgres: cada KPI é uma subconsulta escalar da mesma
 * SELECT, então o painel custa um round-trip por 30 s (cache no
 * serviço), não sete. `commits(status)` e `commits(commit_time)` têm
 * índice; `tickets`/`alerts` são tabelas pequenas. */
export class PrismaAdminOverviewRepository implements AdminOverviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async snapshot(stuckMinutes: number): Promise<OverviewSnapshot> {
    const minutes = Math.trunc(stuckMinutes);
    const [row] = await this.prisma.$queryRaw<SnapshotRow[]>(Prisma.sql`
      SELECT
        (
          SELECT json_agg(json_build_object('type', t.type, 'count', t.count) ORDER BY t.type)
          FROM (SELECT type, count(*)::int AS count FROM users GROUP BY type) AS t
        ) AS users_by_type,
        (SELECT count(*) FROM commits WHERE status = ${CommitStatus.IN_QUEUE}) AS commits_queued,
        (
          SELECT count(*) FROM commits
          WHERE status IN (${CommitStatus.COMPILING}, ${CommitStatus.RUNNING})
            AND coalesce(compilation_started, commit_time) < now() - make_interval(mins => ${minutes})
        ) AS commits_stuck,
        (
          SELECT count(*) FROM commits
          WHERE status = ${CommitStatus.ERROR} AND commit_time >= now() - interval '24 hours'
        ) AS compilation_errors_24h,
        (
          SELECT count(*) FROM commits
          WHERE status = ${CommitStatus.SERVER_ERROR} AND commit_time >= now() - interval '24 hours'
        ) AS server_errors_24h,
        (SELECT count(*) FROM tickets WHERE status = 0) AS tickets_open,
        (SELECT count(*) FROM alerts WHERE valid >= current_date) AS alerts_active
    `);

    return {
      usersByType: (row?.users_by_type ?? []).map((r) => ({ type: Number(r.type), count: Number(r.count) })),
      commitsQueued: Number(row?.commits_queued ?? 0),
      commitsStuck: Number(row?.commits_stuck ?? 0),
      compilationErrors24h: Number(row?.compilation_errors_24h ?? 0),
      serverErrors24h: Number(row?.server_errors_24h ?? 0),
      ticketsOpen: Number(row?.tickets_open ?? 0),
      alertsActive: Number(row?.alerts_active ?? 0),
    };
  }
}
