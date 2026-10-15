import type { PrismaClient, Prisma } from "@prisma/client";
import type { SimilarityPair } from "./plagiarism-provider.js";

export const PlagiarismRunStatus = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export interface PlagiarismRunRecord {
  id: number;
  exerciseId: number;
  provider: string;
  status: string;
  requestedBy: string;
  result: SimilarityPair[] | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface PlagiarismRunRepository {
  create(exerciseId: number, provider: string, requestedBy: string): Promise<PlagiarismRunRecord>;
  findById(id: number): Promise<PlagiarismRunRecord | null>;
  listForExercise(exerciseId: number): Promise<PlagiarismRunRecord[]>;
  markRunning(id: number): Promise<void>;
  markCompleted(id: number, result: SimilarityPair[]): Promise<void>;
  markFailed(id: number, error: string): Promise<void>;
}

export class PrismaPlagiarismRunRepository implements PlagiarismRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(exerciseId: number, provider: string, requestedBy: string): Promise<PlagiarismRunRecord> {
    const row = await this.prisma.plagiarism_runs.create({
      data: { exercise_id: exerciseId, provider, requested_by: requestedBy, status: PlagiarismRunStatus.QUEUED },
    });
    return toRecord(row);
  }

  async findById(id: number): Promise<PlagiarismRunRecord | null> {
    const row = await this.prisma.plagiarism_runs.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async listForExercise(exerciseId: number): Promise<PlagiarismRunRecord[]> {
    const rows = await this.prisma.plagiarism_runs.findMany({
      where: { exercise_id: exerciseId },
      orderBy: { created_at: "desc" },
    });
    return rows.map(toRecord);
  }

  async markRunning(id: number): Promise<void> {
    await this.prisma.plagiarism_runs.update({ where: { id }, data: { status: PlagiarismRunStatus.RUNNING } });
  }

  async markCompleted(id: number, result: SimilarityPair[]): Promise<void> {
    await this.prisma.plagiarism_runs.update({
      where: { id },
      data: {
        status: PlagiarismRunStatus.COMPLETED,
        result: result as unknown as Prisma.InputJsonValue,
        completed_at: new Date(),
      },
    });
  }

  async markFailed(id: number, error: string): Promise<void> {
    await this.prisma.plagiarism_runs.update({
      where: { id },
      data: { status: PlagiarismRunStatus.FAILED, error, completed_at: new Date() },
    });
  }
}

function toRecord(row: {
  id: number;
  exercise_id: number;
  provider: string;
  status: string;
  requested_by: string;
  result: unknown;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
}): PlagiarismRunRecord {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    provider: row.provider,
    status: row.status,
    requestedBy: row.requested_by,
    result: (row.result as SimilarityPair[] | null) ?? null,
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}
