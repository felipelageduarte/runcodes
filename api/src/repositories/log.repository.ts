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
  create(entry: NewLogEntry): Promise<void>;
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

  async create(entry: NewLogEntry): Promise<void> {
    await this.prisma.logs.create({
      data: { user_email: entry.userEmail, ip: entry.ip, action: entry.action },
    });
  }
}
