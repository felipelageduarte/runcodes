import type { PrismaClient } from "@prisma/client";

export interface AlertRecord {
  id: number;
  type: number;
  offeringId: number | null;
  recipients: number;
  userEmail: string;
  valid: Date;
  title: string;
  message: string;
}

export interface NewAlert {
  type: number;
  offeringId: number | null;
  recipients: number;
  userEmail: string;
  valid: Date;
  title: string;
  message: string;
}

export interface AlertPatch {
  type?: number;
  offeringId?: number | null;
  recipients?: number;
  valid?: Date;
  title?: string;
  message?: string;
}

export interface AlertRepository {
  create(input: NewAlert): Promise<AlertRecord>;
  findById(id: number): Promise<AlertRecord | null>;
  /** Alerts still valid (valid >= today), optionally scoped to one
   * offering or the global ones (offeringId null). */
  listActive(offeringId?: number): Promise<AlertRecord[]>;
  list(page: number, pageSize: number): Promise<{ total: number; alerts: AlertRecord[] }>;
  update(id: number, patch: AlertPatch): Promise<AlertRecord | null>;
  delete(id: number): Promise<boolean>;
}

export class PrismaAlertRepository implements AlertRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: NewAlert): Promise<AlertRecord> {
    const row = await this.prisma.alerts.create({
      data: {
        type: input.type,
        offering_id: input.offeringId,
        recipients: input.recipients,
        user_email: input.userEmail,
        valid: input.valid,
        title: input.title,
        message: input.message,
      },
    });
    return toRecord(row);
  }

  async findById(id: number): Promise<AlertRecord | null> {
    const row = await this.prisma.alerts.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async listActive(offeringId?: number): Promise<AlertRecord[]> {
    const rows = await this.prisma.alerts.findMany({
      where: {
        valid: { gte: new Date(new Date().toDateString()) },
        OR: [{ offering_id: null }, ...(offeringId !== undefined ? [{ offering_id: offeringId }] : [])],
      },
      orderBy: { valid: "desc" },
    });
    return rows.map(toRecord);
  }

  async list(page: number, pageSize: number) {
    const [total, rows] = await Promise.all([
      this.prisma.alerts.count(),
      this.prisma.alerts.findMany({
        orderBy: { valid: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, alerts: rows.map(toRecord) };
  }

  async update(id: number, patch: AlertPatch): Promise<AlertRecord | null> {
    try {
      const row = await this.prisma.alerts.update({
        where: { id },
        data: {
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.offeringId !== undefined ? { offering_id: patch.offeringId } : {}),
          ...(patch.recipients !== undefined ? { recipients: patch.recipients } : {}),
          ...(patch.valid !== undefined ? { valid: patch.valid } : {}),
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.message !== undefined ? { message: patch.message } : {}),
        },
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.alerts.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}

function toRecord(row: {
  id: number;
  type: number;
  offering_id: number | null;
  recipients: number;
  user_email: string;
  valid: Date;
  title: string;
  message: string;
}): AlertRecord {
  return {
    id: row.id,
    type: row.type,
    offeringId: row.offering_id,
    recipients: row.recipients,
    userEmail: row.user_email,
    valid: row.valid,
    title: row.title,
    message: row.message,
  };
}
