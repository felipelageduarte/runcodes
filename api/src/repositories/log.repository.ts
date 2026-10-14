import { Prisma, type PrismaClient } from "@prisma/client";

export interface LogRecord {
  id: number;
  userEmail: string;
  datetime: Date;
  ip: string;
  action: string;
}

/** `userEmail`/`ip`/`q` (free text over `action`)/`status` (exact HTTP
 * status, parsed off the end of `action` — see auditLog.ts) combine
 * with AND. `q` and `status` double as the stats() filter, minus
 * pagination. */
export interface LogListFilter {
  userEmail?: string;
  ip?: string;
  q?: string;
  status?: number;
  page: number;
  pageSize: number;
}

export interface LogStats {
  total: number;
  errors: number;
  topAction: string | null;
  topActionCount: number;
}

export interface NewLogEntry {
  userEmail: string;
  ip: string;
  action: string;
}

/**
 * Mirrors LogsController::index() for reads. Writes mirror
 * Log::register(), but called from one place (http/middleware/auditLog.ts)
 * instead of 60+ scattered call sites across controllers — see that
 * file for the cross-cutting design.
 */
export interface LogRepository {
  list(filter: LogListFilter): Promise<{ total: number; logs: LogRecord[] }>;
  stats(filter: Pick<LogListFilter, "userEmail" | "ip" | "q" | "status">): Promise<LogStats>;
  create(entry: NewLogEntry): Promise<void>;
}

export class PrismaLogRepository implements LogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filter: LogListFilter) {
    const where = buildWhere(filter);
    const [total, rows] = await Promise.all([
      this.prisma.logs.count({ where }),
      this.prisma.logs.findMany({
        where,
        orderBy: { datetime: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return {
      total,
      logs: rows.map((r) => ({ id: r.id, userEmail: r.user_email, datetime: r.datetime, ip: r.ip, action: r.action })),
    };
  }

  /** `action` is free text ("METHOD /path -> STATUS", see auditLog.ts)
   * with no separate method/status columns, so error rate and "top
   * action" need a couple of raw queries rather than a Prisma
   * aggregate — filter values stay parameterized via Prisma.sql. */
  async stats(filter: Pick<LogListFilter, "userEmail" | "ip" | "q" | "status">): Promise<LogStats> {
    const conditions: Prisma.Sql[] = [];
    if (filter.userEmail) conditions.push(Prisma.sql`user_email ILIKE ${`%${filter.userEmail}%`}`);
    if (filter.ip) conditions.push(Prisma.sql`ip = ${filter.ip}`);
    if (filter.q) conditions.push(Prisma.sql`action ILIKE ${`%${filter.q}%`}`);
    if (filter.status !== undefined) conditions.push(Prisma.sql`action LIKE ${`% -> ${filter.status}`}`);
    const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

    const [totals] = await this.prisma.$queryRaw<{ total: bigint; errors: bigint }[]>(Prisma.sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE substring(action FROM '-> (\\d{3})$')::int >= 400) AS errors
      FROM logs
      ${where}
    `);
    const [top] = await this.prisma.$queryRaw<{ action_key: string; count: bigint }[]>(Prisma.sql`
      SELECT regexp_replace(action, ' -> \\d{3}$', '') AS action_key, COUNT(*) AS count
      FROM logs
      ${where}
      GROUP BY action_key
      ORDER BY count DESC
      LIMIT 1
    `);

    return {
      total: Number(totals?.total ?? 0),
      errors: Number(totals?.errors ?? 0),
      topAction: top?.action_key ?? null,
      topActionCount: top ? Number(top.count) : 0,
    };
  }

  async create(entry: NewLogEntry): Promise<void> {
    await this.prisma.logs.create({
      data: { user_email: entry.userEmail, ip: entry.ip, action: entry.action },
    });
  }
}

function buildWhere(filter: Pick<LogListFilter, "userEmail" | "ip" | "q" | "status">): Prisma.logsWhereInput {
  const and: Prisma.logsWhereInput[] = [];
  if (filter.userEmail) and.push({ user_email: { contains: filter.userEmail, mode: "insensitive" } });
  if (filter.ip) and.push({ ip: filter.ip });
  if (filter.q) and.push({ action: { contains: filter.q, mode: "insensitive" } });
  if (filter.status !== undefined) and.push({ action: { endsWith: ` -> ${filter.status}` } });
  return and.length ? { AND: and } : {};
}
