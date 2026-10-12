import type { PrismaClient } from "@prisma/client";

export interface LogRecord {
  id: number;
  userEmail: string;
  datetime: Date;
  ip: string;
  action: string;
}

export interface LogListFilter {
  userEmail?: string;
  ip?: string;
  page: number;
  pageSize: number;
}

/**
 * Read-only — mirrors LogsController::index(). Nothing in runcodes-api
 * writes to this table yet: the legacy app calls Log::register() from
 * nearly every mutating controller action, and replicating that as a
 * cross-cutting concern (middleware/decorator across every service) is
 * real design work, not a copy-paste job — tracked in the docs roadmap
 * rather than bolted on here as an afterthought.
 */
export interface LogRepository {
  list(filter: LogListFilter): Promise<{ total: number; logs: LogRecord[] }>;
}

export class PrismaLogRepository implements LogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filter: LogListFilter) {
    const where = {
      ...(filter.userEmail ? { user_email: { contains: filter.userEmail, mode: "insensitive" as const } } : {}),
      ...(filter.ip ? { ip: filter.ip } : {}),
    };
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
}
