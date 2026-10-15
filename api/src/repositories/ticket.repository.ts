import type { PrismaClient } from "@prisma/client";

export const TicketStatus = { OPEN: 0, CLOSED: 1 } as const;

export interface TicketRecord {
  id: number;
  userEmail: string;
  datetime: Date;
  type: number;
  status: number;
  solved: boolean | null;
  priority: number;
  message: string;
}

export interface NewTicket {
  userEmail: string;
  type: number;
  priority: number;
  message: string;
}

export interface TicketPatch {
  type?: number;
  priority?: number;
  message?: string;
}

export interface TicketListFilter {
  status?: number;
  page: number;
  pageSize: number;
}

/** Mirrors TicketsController — support tickets, a flat global queue (not
 * scoped per turma, matching the legacy model: any assistant+ sees every
 * ticket, any authenticated user can file one). */
export interface TicketRepository {
  create(input: NewTicket): Promise<TicketRecord>;
  findById(id: number): Promise<TicketRecord | null>;
  list(filter: TicketListFilter): Promise<{ total: number; tickets: TicketRecord[] }>;
  listForUser(userEmail: string): Promise<TicketRecord[]>;
  update(id: number, patch: TicketPatch): Promise<TicketRecord | null>;
  setSolved(id: number, solved: boolean): Promise<TicketRecord | null>;
  setStatus(id: number, status: number): Promise<TicketRecord | null>;
  delete(id: number): Promise<boolean>;
}

export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: NewTicket): Promise<TicketRecord> {
    const row = await this.prisma.tickets.create({
      data: {
        users_email: input.userEmail,
        type: input.type,
        priority: input.priority,
        message: input.message,
        status: TicketStatus.OPEN,
        solved: false,
      },
    });
    return toRecord(row);
  }

  async findById(id: number): Promise<TicketRecord | null> {
    const row = await this.prisma.tickets.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async list(filter: TicketListFilter) {
    const where = filter.status !== undefined ? { status: filter.status } : {};
    const [total, rows] = await Promise.all([
      this.prisma.tickets.count({ where }),
      this.prisma.tickets.findMany({
        where,
        orderBy: [{ status: "asc" }, { priority: "asc" }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return { total, tickets: rows.map(toRecord) };
  }

  async listForUser(userEmail: string): Promise<TicketRecord[]> {
    const rows = await this.prisma.tickets.findMany({
      where: { users_email: userEmail },
      orderBy: { datetime: "desc" },
    });
    return rows.map(toRecord);
  }

  async update(id: number, patch: TicketPatch): Promise<TicketRecord | null> {
    try {
      const row = await this.prisma.tickets.update({
        where: { id },
        data: {
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.message !== undefined ? { message: patch.message } : {}),
        },
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }

  async setSolved(id: number, solved: boolean): Promise<TicketRecord | null> {
    try {
      const row = await this.prisma.tickets.update({ where: { id }, data: { solved } });
      return toRecord(row);
    } catch {
      return null;
    }
  }

  async setStatus(id: number, status: number): Promise<TicketRecord | null> {
    try {
      const row = await this.prisma.tickets.update({ where: { id }, data: { status } });
      return toRecord(row);
    } catch {
      return null;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.tickets.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}

function toRecord(row: {
  id: number;
  users_email: string;
  datetime: Date;
  type: number;
  status: number;
  solved: boolean | null;
  priority: number;
  message: string;
}): TicketRecord {
  return {
    id: row.id,
    userEmail: row.users_email,
    datetime: row.datetime,
    type: row.type,
    status: row.status,
    solved: row.solved,
    priority: row.priority,
    message: row.message,
  };
}
