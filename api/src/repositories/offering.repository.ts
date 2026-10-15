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
  /** Busca textual (case-insensitive) em código/título da disciplina e
   * sala — cobre o catálogo admin sem precisar paginar na mão. */
  q?: string;
  page: number;
  pageSize: number;
}

export interface NewOffering {
  courseId: number;
  classroom: string | null;
  endDate: Date;
  enrollmentCode: string;
}

export interface OfferingUpdate {
  classroom?: string | null;
  endDate?: Date;
}

export interface OfferingRepository {
  list(filter: ListOfferingsFilter): Promise<{ total: number; offerings: OfferingRecord[] }>;
  findById(id: number): Promise<OfferingRecord | null>;
  findByIds(ids: number[]): Promise<OfferingRecord[]>;
  findByEnrollmentCode(code: string): Promise<OfferingRecord | null>;
  create(data: NewOffering): Promise<OfferingRecord>;
  update(id: number, data: OfferingUpdate): Promise<OfferingRecord | null>;
}

export class PrismaOfferingRepository implements OfferingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filter: ListOfferingsFilter) {
    const now = new Date();
    const q = filter.q?.trim();
    const where = {
      end_date: filter.closed ? { lte: now } : { gt: now },
      ...(filter.universityId !== undefined
        ? { courses: { university_id: filter.universityId } }
        : {}),
      ...(q
        ? {
            OR: [
              { classroom: { contains: q, mode: "insensitive" as const } },
              { courses: { code: { contains: q, mode: "insensitive" as const } } },
              { courses: { title: { contains: q, mode: "insensitive" as const } } },
            ],
          }
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

  async create(data: NewOffering): Promise<OfferingRecord> {
    const row = await this.prisma.offerings.create({
      data: {
        course_id: data.courseId,
        // Mirrors OfferingsController::add() — the legacy form never
        // actually collects year/term, it hardcodes both to 0 regardless
        // of how old the offering gets; classroom is what distinguishes
        // turmas of the same course (see @@unique on the table).
        year: 0,
        term: 0,
        classroom: data.classroom,
        end_date: data.endDate,
        enrollment_code: data.enrollmentCode,
      },
    });
    return toRecord(row);
  }

  async update(id: number, data: OfferingUpdate): Promise<OfferingRecord | null> {
    try {
      const row = await this.prisma.offerings.update({
        where: { id },
        data: {
          ...(data.classroom !== undefined ? { classroom: data.classroom } : {}),
          ...(data.endDate !== undefined ? { end_date: data.endDate } : {}),
        },
      });
      return toRecord(row);
    } catch {
      return null;
    }
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
