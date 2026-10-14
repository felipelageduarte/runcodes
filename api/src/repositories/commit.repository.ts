import type { PrismaClient } from "@prisma/client";

export interface CommitRecord {
  id: number;
  userEmail: string;
  exerciseId: number;
  commitTime: Date;
  status: number;
  hash: string | null;
  corrects: number | null;
  score: string | null;
  compiled: boolean | null;
  compiledMessage: string | null;
  /** Unix signal name (e.g. "SIGSEGV") when the engine killed the
   * process — null/empty when the commit didn't end that way. See
   * docs/roadmap/gap-audit-2026-10.md item 23: never exposed before
   * Fase 11, the frontend only showed the raw status, not why a crash
   * happened. */
  compiledSignal: string | null;
  awsKey: string | null;
  ip: string | null;
}

export interface NewCommit {
  userEmail: string;
  exerciseId: number;
  status: number;
  hash: string;
  awsKey: string;
  ip: string | null;
}

export interface CommitScorePatch {
  score: string;
  status: number;
}

export interface CommitRepository {
  create(input: NewCommit): Promise<CommitRecord>;
  findById(id: number): Promise<CommitRecord | null>;
  listForUserOnExercise(exerciseId: number, userEmail: string): Promise<CommitRecord[]>;
  /** Mirrors CommitsController::editScore() — professor overrides nota/status. */
  updateScore(id: number, patch: CommitScorePatch): Promise<CommitRecord | null>;
  /** Mirrors the reset CommitsController::recompile()/recompileAll() do
   * before re-queuing: status back to IN_QUEUE, compiled fields cleared —
   * the compiler-engine overwrites everything else once it reprocesses. */
  resetToQueue(id: number): Promise<CommitRecord | null>;
  resetManyToQueue(ids: number[]): Promise<void>;
  /** Minimal columns, platform-wide (no offering/exercise filter) — backs
   * the admin's global activity panel (docs/roadmap/gap-audit-2026-10.md
   * item 20). Aggregation happens in JS, same "fine at this scale"
   * trade-off the marketplace stats already made — see
   * marketplace-stats.service.ts. */
  listSince(date: Date): Promise<{ commitTime: Date; status: number }[]>;
  /** Each enrolled student's most recent commit on the exercise (one row
   * per student) — the dataset a plagiarism comparison runs against. */
  listLatestPerStudentForExercise(exerciseId: number): Promise<CommitRecord[]>;
  /** One student's most recent commit on each of several exercises (at
   * most one row per exercise) — backs the offering's exercise list
   * showing the student's own status per exercise in a single query
   * instead of one request per exercise. */
  listLatestForUserAcrossExercises(userEmail: string, exerciseIds: number[]): Promise<CommitRecord[]>;
}

export class PrismaCommitRepository implements CommitRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: NewCommit): Promise<CommitRecord> {
    const row = await this.prisma.commits.create({
      data: {
        user_email: input.userEmail,
        exercise_id: input.exerciseId,
        status: input.status,
        hash: input.hash,
        aws_key: input.awsKey,
        ip: input.ip,
      },
    });
    return toRecord(row);
  }

  async findById(id: number): Promise<CommitRecord | null> {
    const row = await this.prisma.commits.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async listForUserOnExercise(exerciseId: number, userEmail: string): Promise<CommitRecord[]> {
    const rows = await this.prisma.commits.findMany({
      where: { exercise_id: exerciseId, user_email: userEmail },
      orderBy: { commit_time: "desc" },
    });
    return rows.map(toRecord);
  }

  async listLatestPerStudentForExercise(exerciseId: number): Promise<CommitRecord[]> {
    const rows = await this.prisma.commits.findMany({
      where: { exercise_id: exerciseId, aws_key: { not: null } },
      distinct: ["user_email"],
      orderBy: [{ user_email: "asc" }, { commit_time: "desc" }],
    });
    return rows.map(toRecord);
  }

  async updateScore(id: number, patch: CommitScorePatch): Promise<CommitRecord | null> {
    try {
      const row = await this.prisma.commits.update({
        where: { id },
        data: { score: patch.score, status: patch.status },
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }

  async resetToQueue(id: number): Promise<CommitRecord | null> {
    try {
      const row = await this.prisma.commits.update({
        where: { id },
        data: { status: 0, compiled_message: "", compiled: false, corrects: 0, score: "0" },
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }

  async resetManyToQueue(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.commits.updateMany({
      where: { id: { in: ids } },
      data: { status: 0, compiled_message: "", compiled: false, corrects: 0, score: "0" },
    });
  }

  async listSince(date: Date): Promise<{ commitTime: Date; status: number }[]> {
    const rows = await this.prisma.commits.findMany({
      where: { commit_time: { gte: date } },
      select: { commit_time: true, status: true },
    });
    return rows.map((r) => ({ commitTime: r.commit_time, status: r.status }));
  }

  async listLatestForUserAcrossExercises(
    userEmail: string,
    exerciseIds: number[],
  ): Promise<CommitRecord[]> {
    if (exerciseIds.length === 0) return [];
    const rows = await this.prisma.commits.findMany({
      where: { user_email: userEmail, exercise_id: { in: exerciseIds } },
      distinct: ["exercise_id"],
      orderBy: [{ exercise_id: "asc" }, { commit_time: "desc" }],
    });
    return rows.map(toRecord);
  }
}

function toRecord(row: {
  id: number;
  user_email: string;
  exercise_id: number;
  commit_time: Date;
  status: number;
  hash: string | null;
  corrects: number | null;
  score: unknown;
  compiled: boolean | null;
  compiled_message: string | null;
  compiled_signal: string | null;
  aws_key: string | null;
  ip: string | null;
}): CommitRecord {
  return {
    id: row.id,
    userEmail: row.user_email,
    exerciseId: row.exercise_id,
    commitTime: row.commit_time,
    status: row.status,
    hash: row.hash,
    corrects: row.corrects,
    score: row.score === null || row.score === undefined ? null : String(row.score),
    compiled: row.compiled,
    compiledMessage: row.compiled_message,
    compiledSignal: row.compiled_signal || null,
    awsKey: row.aws_key,
    ip: row.ip,
  };
}
