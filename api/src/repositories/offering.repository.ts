import type { PrismaClient } from "@prisma/client";

export interface OfferingRecord {
  id: number;
  courseId: number;
  year: number;
  term: number;
  classroom: string | null;
  endDate: Date;
  enrollmentCode: string | null;
  maxStudents: number | null;
  maxExercises: number | null;
}

export interface ListOfferingsFilter {
  closed: boolean;
  universityId?: number;
  page: number;
  pageSize: number;
}

export interface OfferingRepository {
  list(filter: ListOfferingsFilter): Promise<{ total: number; offerings: OfferingRecord[] }>;
  findById(id: number): Promise<OfferingRecord | null>;
  findByIds(ids: number[]): Promise<OfferingRecord[]>;
  findByEnrollmentCode(code: string): Promise<OfferingRecord | null>;
}

export class PrismaOfferingRepository implements OfferingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filter: ListOfferingsFilter) {
    const now = new Date();
    const where = {
      end_date: filter.closed ? { lte: now } : { gt: now },
      ...(filter.universityId !== undefined
        ? { courses: { university_id: filter.universityId } }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.offerings.count({ where }),
      this.prisma.offerings.findMany({
        where,
        orderBy: { end_date: "asc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return { total, offerings: rows.map(toRecord) };
  }

  async findById(id: number): Promise<OfferingRecord | null> {
    const row = await this.prisma.offerings.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findByIds(ids: number[]): Promise<OfferingRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.offerings.findMany({ where: { id: { in: ids } } });
    return rows.map(toRecord);
  }

  async findByEnrollmentCode(code: string): Promise<OfferingRecord | null> {
    const row = await this.prisma.offerings.findFirst({
      where: { enrollment_code: code.toUpperCase() },
    });
    return row ? toRecord(row) : null;
  }
}

function toRecord(row: {
  id: number;
  course_id: number;
  year: number;
  term: number;
  classroom: string | null;
  end_date: Date;
  enrollment_code: string | null;
  max_students: number | null;
  max_exercises: number | null;
}): OfferingRecord {
  return {
    id: row.id,
    courseId: row.course_id,
    year: row.year,
    term: row.term,
    classroom: row.classroom,
    endDate: row.end_date,
    enrollmentCode: row.enrollment_code,
    maxStudents: row.max_students,
    maxExercises: row.max_exercises,
  };
}
