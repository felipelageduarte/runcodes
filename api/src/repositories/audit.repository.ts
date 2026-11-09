import { Prisma, type PrismaClient } from "@prisma/client";

/** Uma linha de `audit_log` (migration 007). `requestBody` já chega
 * redigido e truncado pelo middleware (http/middleware/auditLog.ts);
 * o repositório não interpreta o conteúdo. */
export interface AuditEntry {
  actorEmail: string | null;
  actorType: number | null;
  /** Tipo que o ator está impersonando via "view as" (null fora do modo). */
  viewAsType: number | null;
  method: string;
  path: string;
  /** `path` com ids e e-mails substituídos por `:id`/`:email`. */
  route: string;
  status: number;
  durationMs: number | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  requestBody: unknown;
  targetType?: string | null;
  targetId?: string | null;
}

export interface AuditRecord extends AuditEntry {
  id: number;
  at: Date;
}

export interface AuditFeedFilter {
  actor?: string;
  method?: string;
  status?: number;
  route?: string;
  since?: Date;
  until?: Date;
  q?: string;
  limit: number;
  offset: number;
}

export interface AuditStats {
  days: number;
  total: number;
  errors: number;
  avgDurationMs: number;
  actors: number;
  topActions: { action: string; count: number; avgMs: number }[];
  topActors: { actorEmail: string; count: number }[];
  daily: { day: string; count: number; errors: number }[];
}

export interface AuditRepository {
  create(entry: AuditEntry): Promise<void>;
  feed(filter: AuditFeedFilter): Promise<{ total: number; items: AuditRecord[] }>;
  stats(days: number): Promise<AuditStats>;
  /** Retenção: apaga linhas mais velhas que `days`. Devolve quantas saíram. */
  purgeOlderThan(days: number): Promise<number>;
}

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(entry: AuditEntry): Promise<void> {
    await this.prisma.audit_log.create({
      data: {
        actor_email: entry.actorEmail,
        actor_type: entry.actorType,
        view_as_type: entry.viewAsType,
        method: entry.method,
        path: entry.path,
        route: entry.route,
        status: entry.status,
        duration_ms: entry.durationMs,
        ip: entry.ip,
        user_agent: entry.userAgent,
        request_id: entry.requestId,
        request_body:
          entry.requestBody === null || entry.requestBody === undefined
            ? Prisma.JsonNull
            : (entry.requestBody as Prisma.InputJsonValue),
        target_type: entry.targetType ?? null,
        target_id: entry.targetId ?? null,
      },
    });
  }

  async feed(filter: AuditFeedFilter) {
    const where = buildWhere(filter);
    const [total, rows] = await Promise.all([
      this.prisma.audit_log.count({ where }),
      this.prisma.audit_log.findMany({
        where,
        orderBy: [{ at: "desc" }, { id: "desc" }],
        skip: filter.offset,
        take: filter.limit,
      }),
    ]);
    return {
      total,
      items: rows.map((r) => ({
        id: Number(r.id),
        at: r.at,
        actorEmail: r.actor_email,
        actorType: r.actor_type,
        viewAsType: r.view_as_type,
        method: r.method,
        path: r.path,
        route: r.route,
        status: r.status,
        durationMs: r.duration_ms,
        ip: r.ip,
        userAgent: r.user_agent,
        requestId: r.request_id,
        requestBody: r.request_body,
        targetType: r.target_type,
        targetId: r.target_id,
      })),
    };
  }

  /** Agregações em SQL cru (GROUP BY com FILTER e AVG não cabem no
   * aggregate do Prisma). `days` entra parametrizado. */
  async stats(days: number): Promise<AuditStats> {
    const since = Prisma.sql`at >= now() - make_interval(days => ${days})`;
    const [totals] = await this.prisma.$queryRaw<
      { total: bigint; errors: bigint; avg_ms: number | null; actors: bigint }[]
    >(Prisma.sql`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status >= 400) AS errors,
             AVG(duration_ms) AS avg_ms,
             COUNT(DISTINCT actor_email) AS actors
      FROM audit_log WHERE ${since}
    `);
    const topActions = await this.prisma.$queryRaw<{ action: string; count: bigint; avg_ms: number | null }[]>(
      Prisma.sql`
      SELECT method || ' ' || route AS action, COUNT(*) AS count, AVG(duration_ms) AS avg_ms
      FROM audit_log WHERE ${since}
      GROUP BY method, route ORDER BY count DESC LIMIT 20
    `,
    );
    const topActors = await this.prisma.$queryRaw<{ actor_email: string | null; count: bigint }[]>(Prisma.sql`
      SELECT actor_email, COUNT(*) AS count
      FROM audit_log WHERE ${since} AND actor_email IS NOT NULL
      GROUP BY actor_email ORDER BY count DESC LIMIT 20
    `);
    const daily = await this.prisma.$queryRaw<{ day: Date; count: bigint; errors: bigint }[]>(Prisma.sql`
      SELECT date(at AT TIME ZONE 'America/Sao_Paulo') AS day,
             COUNT(*) AS count,
             COUNT(*) FILTER (WHERE status >= 400) AS errors
      FROM audit_log WHERE ${since}
      GROUP BY day ORDER BY day
    `);

    return {
      days,
      total: Number(totals?.total ?? 0),
      errors: Number(totals?.errors ?? 0),
      avgDurationMs: Math.round(Number(totals?.avg_ms ?? 0)),
      actors: Number(totals?.actors ?? 0),
      topActions: topActions.map((r) => ({
        action: r.action,
        count: Number(r.count),
        avgMs: Math.round(Number(r.avg_ms ?? 0)),
      })),
      topActors: topActors.map((r) => ({ actorEmail: r.actor_email ?? "", count: Number(r.count) })),
      daily: daily.map((r) => ({
        day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day),
        count: Number(r.count),
        errors: Number(r.errors),
      })),
    };
  }

  async purgeOlderThan(days: number): Promise<number> {
    const { count } = await this.prisma.audit_log.deleteMany({
      where: { at: { lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } },
    });
    return count;
  }
}

function buildWhere(filter: AuditFeedFilter): Prisma.audit_logWhereInput {
  const and: Prisma.audit_logWhereInput[] = [];
  if (filter.actor) and.push({ actor_email: { contains: filter.actor, mode: "insensitive" } });
  if (filter.method) and.push({ method: filter.method.toUpperCase() });
  if (filter.status !== undefined) and.push({ status: filter.status });
  if (filter.route) and.push({ route: { contains: filter.route, mode: "insensitive" } });
  if (filter.since) and.push({ at: { gte: filter.since } });
  if (filter.until) and.push({ at: { lte: filter.until } });
  if (filter.q) {
    const contains = { contains: filter.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { path: contains },
        { route: contains },
        { actor_email: contains },
        { ip: contains },
        { request_id: contains },
        { user_agent: contains },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}
