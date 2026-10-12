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
  markdown: boolean | null;
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

export interface NewExercise {
  offeringId: number;
  title: string;
  description: string | null;
  deadline: Date;
  openDate: Date | null;
  type: number;
  showBeforeOpening: boolean;
  markdown: boolean;
  userEmail: string;
  /** Set together, only when creating a ghost clone — mirrors Exercise::createGhostExercise(). */
  ghost?: boolean;
  realId?: number | null;
}

export interface ExercisePatch {
  title?: string;
  description?: string | null;
  deadline?: Date;
  openDate?: Date | null;
  type?: number;
  showBeforeOpening?: boolean;
  markdown?: boolean;
}

export interface ExerciseRepository {
  findById(id: number): Promise<ExerciseRecord | null>;
  list(filter: ListExercisesFilter): Promise<{ total: number; exercises: ExerciseRecord[] }>;
  listVisible(filter: VisibleExercisesFilter): Promise<ExerciseRecord[]>;
  countCases(exerciseId: number): Promise<number>;
  findAllowedExtensions(exerciseId: number): Promise<string[]>;
  create(input: NewExercise): Promise<ExerciseRecord>;
  update(id: number, patch: ExercisePatch): Promise<ExerciseRecord | null>;
  /** Soft delete (removed=true), cascading to any ghost clones (real_id = id) — mirrors ExercisesController::delete(). */
  softDelete(id: number): Promise<boolean>;
  setAllowedFiles(exerciseId: number, allowedFileIds: number[]): Promise<void>;
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

  async create(input: NewExercise): Promise<ExerciseRecord> {
    const row = await this.prisma.exercises.create({
      data: {
        offering_id: input.offeringId,
        title: input.title,
        description: input.description,
        deadline: input.deadline,
        open_date: input.openDate,
        type: input.type,
        show_before_opening: input.showBeforeOpening,
        markdown: input.markdown,
        user_email: input.userEmail,
        removed: false,
        ghost: input.ghost ?? false,
        real_id: input.realId ?? null,
      },
    });
    return toRecord(row);
  }

  async update(id: number, patch: ExercisePatch): Promise<ExerciseRecord | null> {
    try {
      const row = await this.prisma.exercises.update({
        where: { id },
        data: {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.deadline !== undefined ? { deadline: patch.deadline } : {}),
          ...(patch.openDate !== undefined ? { open_date: patch.openDate } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.showBeforeOpening !== undefined ? { show_before_opening: patch.showBeforeOpening } : {}),
          ...(patch.markdown !== undefined ? { markdown: patch.markdown } : {}),
        },
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }

  async softDelete(id: number): Promise<boolean> {
    try {
      await this.prisma.exercises.update({ where: { id }, data: { removed: true } });
      await this.prisma.exercises.updateMany({ where: { real_id: id }, data: { removed: true } });
      return true;
    } catch {
      return false;
    }
  }

  async setAllowedFiles(exerciseId: number, allowedFileIds: number[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.allowed_files_exercises.deleteMany({ where: { exercise_id: exerciseId } }),
      ...allowedFileIds.map((allowedFileId) =>
        this.prisma.allowed_files_exercises.create({
          data: { exercise_id: exerciseId, allowed_file_id: allowedFileId },
        }),
      ),
    ]);
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
  markdown: boolean | null;
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
    markdown: row.markdown,
  };
}
