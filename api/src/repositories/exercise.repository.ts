import type { PrismaClient } from "@prisma/client";

export interface ExerciseRecord {
  id: number;
  offeringId: number;
  title: string;
  description: string | null;
  deadline: Date;
  type: number;
  openDate: Date | null;
  showBeforeOpening: boolean | null;
  removed: boolean | null;
  ghost: boolean | null;
  realId: number | null;
}

export interface ListExercisesFilter {
  universityId?: number;
  title?: string;
  dateRange: { openBefore?: Date; openAfter?: Date; deadlineBefore?: Date; deadlineAfter?: Date };
  page: number;
  pageSize: number;
}

export interface VisibleExercisesFilter {
  offeringId: number;
  /** When false, only exercises already open (or explicitly pre-visible) are returned. */
  includeUnopened: boolean;
}

export interface ExerciseRepository {
  findById(id: number): Promise<ExerciseRecord | null>;
  list(filter: ListExercisesFilter): Promise<{ total: number; exercises: ExerciseRecord[] }>;
  listVisible(filter: VisibleExercisesFilter): Promise<ExerciseRecord[]>;
  countCases(exerciseId: number): Promise<number>;
  findAllowedExtensions(exerciseId: number): Promise<string[]>;
}

export class PrismaExerciseRepository implements ExerciseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: number): Promise<ExerciseRecord | null> {
    const row = await this.prisma.exercises.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async list(filter: ListExercisesFilter) {
    const { openBefore, openAfter, deadlineBefore, deadlineAfter } = filter.dateRange;
    const where = {
      ...(openBefore || openAfter
        ? { open_date: { ...(openBefore ? { lte: openBefore } : {}), ...(openAfter ? { gt: openAfter } : {}) } }
        : {}),
      ...(deadlineBefore || deadlineAfter
        ? {
            deadline: {
              ...(deadlineBefore ? { lte: deadlineBefore } : {}),
              ...(deadlineAfter ? { gt: deadlineAfter } : {}),
            },
          }
        : {}),
      ...(filter.title ? { title: { contains: filter.title, mode: "insensitive" as const } } : {}),
      ...(filter.universityId !== undefined
        ? { offerings: { courses: { university_id: filter.universityId } } }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.exercises.count({ where }),
      this.prisma.exercises.findMany({
        where,
        orderBy: { deadline: "asc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return { total, exercises: rows.map(toRecord) };
  }

  async listVisible(filter: VisibleExercisesFilter): Promise<ExerciseRecord[]> {
    const rows = await this.prisma.exercises.findMany({
      where: {
        offering_id: filter.offeringId,
        removed: false,
        ...(filter.includeUnopened
          ? {}
          : { OR: [{ open_date: { lt: new Date() } }, { show_before_opening: true }] }),
      },
      orderBy: [{ deadline: "asc" }, { title: "asc" }],
    });
    return rows.map(toRecord);
  }

  async countCases(exerciseId: number): Promise<number> {
    return this.prisma.exercise_cases.count({ where: { exercise_id: exerciseId } });
  }

  async findAllowedExtensions(exerciseId: number): Promise<string[]> {
    const links = await this.prisma.allowed_files_exercises.findMany({
      where: { exercise_id: exerciseId },
      select: { allowed_file_id: true },
    });
    const ids = links.map((l) => l.allowed_file_id).filter((id): id is number => id !== null);
    if (ids.length === 0) return [];
    const files = await this.prisma.allowed_files.findMany({ where: { id: { in: ids } } });
    return files.map((f) => f.extension.replace(/^\*\./, "").toLowerCase());
  }
}

function toRecord(row: {
  id: number;
  offering_id: number;
  title: string;
  description: string | null;
  deadline: Date;
  type: number;
  open_date: Date | null;
  show_before_opening: boolean | null;
  removed: boolean | null;
  ghost: boolean | null;
  real_id: number | null;
}): ExerciseRecord {
  return {
    id: row.id,
    offeringId: row.offering_id,
    title: row.title,
    description: row.description,
    deadline: row.deadline,
    type: row.type,
    openDate: row.open_date,
    showBeforeOpening: row.show_before_opening,
    removed: row.removed,
    ghost: row.ghost,
    realId: row.real_id,
  };
}
