import type { PrismaClient } from "@prisma/client";

export interface CourseRecord {
  id: number;
  code: string;
  title: string;
  universityId: number;
}

export interface ListCoursesFilter {
  universityId?: number;
  code?: string;
  title?: string;
  page: number;
  pageSize: number;
}

export interface CourseRepository {
  list(filter: ListCoursesFilter): Promise<{ total: number; courses: CourseRecord[] }>;
  findById(id: number): Promise<CourseRecord | null>;
  searchByUniversity(universityId: number, search?: string): Promise<CourseRecord[]>;
}

export class PrismaCourseRepository implements CourseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filter: ListCoursesFilter) {
    const where = {
      ...(filter.universityId !== undefined ? { university_id: filter.universityId } : {}),
      ...(filter.code ? { code: { contains: filter.code, mode: "insensitive" as const } } : {}),
      ...(filter.title ? { title: { contains: filter.title, mode: "insensitive" as const } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.courses.count({ where }),
      this.prisma.courses.findMany({
        where,
        orderBy: { university_id: "asc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return { total, courses: rows.map(toRecord) };
  }

  async findById(id: number): Promise<CourseRecord | null> {
    const row = await this.prisma.courses.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async searchByUniversity(universityId: number, search?: string): Promise<CourseRecord[]> {
    const rows = await this.prisma.courses.findMany({
      where: {
        university_id: universityId,
        NOT: { title: "RUN0001 - Run Codes Test" },
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" as const } },
                { code: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { title: "asc" },
    });
    return rows.map(toRecord);
  }
}

function toRecord(row: {
  id: number;
  code: string;
  title: string;
  university_id: number;
}): CourseRecord {
  return { id: row.id, code: row.code, title: row.title, universityId: row.university_id };
}
