import type { PrismaClient } from "@prisma/client";

export interface ExerciseCaseFileRecord {
  id: number;
  exerciseCaseId: number;
  path: string;
}

/** Mirrors ExerciseCaseFile — one row per uploaded test-case input file
 * (a case can have several, e.g. a program under test plus a data file
 * it reads). Content lives in S3 via CaseStorageRepository; this is just
 * "what files exist for this case". */
export interface ExerciseCaseFileRepository {
  listForCase(exerciseCaseId: number): Promise<ExerciseCaseFileRecord[]>;
  findById(id: number): Promise<ExerciseCaseFileRecord | null>;
  create(exerciseCaseId: number, path: string): Promise<ExerciseCaseFileRecord>;
  delete(id: number): Promise<boolean>;
}

export class PrismaExerciseCaseFileRepository implements ExerciseCaseFileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listForCase(exerciseCaseId: number): Promise<ExerciseCaseFileRecord[]> {
    const rows = await this.prisma.exercise_case_files.findMany({ where: { exercise_case_id: exerciseCaseId } });
    return rows.map(toRecord);
  }

  async findById(id: number): Promise<ExerciseCaseFileRecord | null> {
    const row = await this.prisma.exercise_case_files.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async create(exerciseCaseId: number, path: string): Promise<ExerciseCaseFileRecord> {
    const row = await this.prisma.exercise_case_files.create({
      data: { exercise_case_id: exerciseCaseId, path },
    });
    return toRecord(row);
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.exercise_case_files.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}

function toRecord(row: { id: number; exercise_case_id: number; path: string }): ExerciseCaseFileRecord {
  return { id: row.id, exerciseCaseId: row.exercise_case_id, path: row.path };
}
