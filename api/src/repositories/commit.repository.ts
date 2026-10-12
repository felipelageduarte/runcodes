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

export interface CommitRepository {
  create(input: NewCommit): Promise<CommitRecord>;
  findById(id: number): Promise<CommitRecord | null>;
  listForUserOnExercise(exerciseId: number, userEmail: string): Promise<CommitRecord[]>;
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
    awsKey: row.aws_key,
    ip: row.ip,
  };
}
