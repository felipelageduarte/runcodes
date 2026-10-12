import type { PrismaClient } from "@prisma/client";

export interface CommitCaseResultRecord {
  id: number;
  exerciseCaseId: number;
  cputime: string;
  memused: number;
  outputType: number;
  status: number;
  statusMessage: string | null;
  error: string | null;
  output: string;
  showInput: boolean | null;
  showExpectedOutput: boolean | null;
  showUserOutput: boolean | null;
}

/** Read-only — commits_exercise_cases rows are written by the
 * compiler-engine, never by this API. Mirrors CommitsExerciseCasesController. */
export interface CommitCaseResultRepository {
  listForCommit(commitId: number): Promise<CommitCaseResultRecord[]>;
}

export class PrismaCommitCaseResultRepository implements CommitCaseResultRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listForCommit(commitId: number): Promise<CommitCaseResultRecord[]> {
    const rows = await this.prisma.commits_exercise_cases.findMany({
      where: { commit_id: commitId },
      orderBy: { exercise_case_id: "asc" },
      include: {
        exercise_cases: {
          select: { show_input: true, show_expected_output: true, show_user_output: true },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      exerciseCaseId: row.exercise_case_id,
      cputime: row.cputime.toString(),
      memused: row.memused,
      outputType: row.output_type,
      status: row.status,
      statusMessage: row.status_message,
      error: row.error,
      output: row.output,
      showInput: row.exercise_cases.show_input,
      showExpectedOutput: row.exercise_cases.show_expected_output,
      showUserOutput: row.exercise_cases.show_user_output,
    }));
  }
}
