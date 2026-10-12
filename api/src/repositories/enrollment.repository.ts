import type { PrismaClient } from "@prisma/client";

export const EnrollmentRole = { STUDENT: 0, ASSISTANT: 1, PROFESSOR: 2 } as const;

export interface EnrollmentRecord {
  id: number;
  offeringId: number;
  userEmail: string;
  role: number;
  banned: boolean;
}

export interface EnrollmentRepository {
  isEnrolled(email: string, offeringId: number): Promise<boolean>;
  isStaff(email: string, offeringId: number): Promise<boolean>;
  findOne(email: string, offeringId: number): Promise<EnrollmentRecord | null>;
  listForUser(email: string, opts?: { staffOnly?: boolean; openOnly?: boolean }): Promise<number[]>;
  listRecordsForUser(email: string): Promise<EnrollmentRecord[]>;
  listStaffForOfferings(
    offeringIds: number[],
  ): Promise<Map<number, { role: number; email: string; name: string }[]>>;
  create(offeringId: number, email: string, role: number): Promise<EnrollmentRecord>;
}

export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async isEnrolled(email: string, offeringId: number): Promise<boolean> {
    const count = await this.prisma.enrollments.count({
      where: { user_email: email, offering_id: offeringId, banned: false },
    });
    return count > 0;
  }

  async isStaff(email: string, offeringId: number): Promise<boolean> {
    const count = await this.prisma.enrollments.count({
      where: {
        user_email: email,
        offering_id: offeringId,
        banned: false,
        role: { in: [EnrollmentRole.PROFESSOR, EnrollmentRole.ASSISTANT] },
      },
    });
    return count > 0;
  }

  async findOne(email: string, offeringId: number): Promise<EnrollmentRecord | null> {
    const row = await this.prisma.enrollments.findUnique({
      where: { offering_id_user_email: { offering_id: offeringId, user_email: email } },
    });
    return row ? toRecord(row) : null;
  }

  async listForUser(
    email: string,
    opts: { staffOnly?: boolean; openOnly?: boolean } = {},
  ): Promise<number[]> {
    const rows = await this.prisma.enrollments.findMany({
      where: {
        user_email: email,
        banned: false,
        ...(opts.staffOnly ? { role: { gt: EnrollmentRole.STUDENT } } : {}),
        ...(opts.openOnly ? { offerings: { end_date: { gt: new Date() } } } : {}),
      },
      select: { offering_id: true },
    });
    return rows.map((r) => r.offering_id);
  }

  async listRecordsForUser(email: string): Promise<EnrollmentRecord[]> {
    const rows = await this.prisma.enrollments.findMany({
      where: { user_email: email, banned: false },
    });
    return rows.map(toRecord);
  }

  async listStaffForOfferings(offeringIds: number[]) {
    if (offeringIds.length === 0) return new Map();
    const rows = await this.prisma.enrollments.findMany({
      where: {
        offering_id: { in: offeringIds },
        banned: false,
        role: { in: [EnrollmentRole.PROFESSOR, EnrollmentRole.ASSISTANT] },
      },
      select: { offering_id: true, role: true, users: { select: { email: true, name: true } } },
    });
    const byOffering = new Map<number, { role: number; email: string; name: string }[]>();
    for (const r of rows) {
      const list = byOffering.get(r.offering_id) ?? [];
      list.push({ role: r.role, email: r.users.email, name: r.users.name });
      byOffering.set(r.offering_id, list);
    }
    return byOffering;
  }

  async create(offeringId: number, email: string, role: number): Promise<EnrollmentRecord> {
    const row = await this.prisma.enrollments.create({
      data: { offering_id: offeringId, user_email: email, role },
    });
    return toRecord(row);
  }
}

function toRecord(row: {
  id: number;
  offering_id: number;
  user_email: string;
  role: number;
  banned: boolean | null;
}): EnrollmentRecord {
  return {
    id: row.id,
    offeringId: row.offering_id,
    userEmail: row.user_email,
    role: row.role,
    banned: row.banned ?? false,
  };
}
