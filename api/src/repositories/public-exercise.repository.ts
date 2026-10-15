import type { PrismaClient } from "@prisma/client";

export interface PublicExerciseRecord {
  id: number;
  exerciseId: number;
  level: number | null;
  obs: string | null;
  keywords: string | null;
  createdAt: Date;
}

export interface NewPublicExercise {
  exerciseId: number;
  level: number;
  obs: string | null;
  keywords: string | null;
}

/** Mirrors PublicExercisesController — marking an exercise as reusable by
 * other professors, browsable as a small catalog. */
export interface PublicExerciseRepository {
  findByExerciseId(exerciseId: number): Promise<PublicExerciseRecord | null>;
  create(input: NewPublicExercise): Promise<PublicExerciseRecord>;
  list(page: number, pageSize: number): Promise<{ total: number; entries: PublicExerciseRecord[] }>;
  /** Every published row, unpaginated — the marketplace's search/filter/
   * sort runs in application code after joining in exercise/offering/
   * university data no FK ties this table to (see marketplace.service.ts).
   * Catalog is small enough that this beats maintaining a materialized
   * view; revisit if it grows (same call the docs make for the stats
   * aggregation). */
  listAll(): Promise<PublicExerciseRecord[]>;
}

export class PrismaPublicExerciseRepository implements PublicExerciseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByExerciseId(exerciseId: number): Promise<PublicExerciseRecord | null> {
    const row = await this.prisma.public_exercises.findFirst({ where: { exercise_id: exerciseId } });
    return row ? toRecord(row) : null;
  }

  async create(input: NewPublicExercise): Promise<PublicExerciseRecord> {
    const row = await this.prisma.public_exercises.create({
      data: { exercise_id: input.exerciseId, level: input.level, obs: input.obs, keywords: input.keywords },
    });
    return toRecord(row);
  }

  async list(page: number, pageSize: number) {
    const [total, rows] = await Promise.all([
      this.prisma.public_exercises.count(),
      this.prisma.public_exercises.findMany({
        orderBy: [{ level: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, entries: rows.map(toRecord) };
  }

  async listAll(): Promise<PublicExerciseRecord[]> {
    const rows = await this.prisma.public_exercises.findMany({ orderBy: { created_at: "desc" } });
    return rows.map(toRecord);
  }
}

function toRecord(row: {
  id: number;
  exercise_id: number;
  level: number | null;
  obs: string | null;
  keywords: string | null;
  created_at: Date;
}): PublicExerciseRecord {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    level: row.level,
    obs: row.obs,
    keywords: row.keywords,
    createdAt: row.created_at,
  };
}
