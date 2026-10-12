import type { CommitRepository } from "../repositories/commit.repository.js";
import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { CommitCaseResultRepository } from "../repositories/commit-case-result.repository.js";
import type { CaseStorageRepository } from "../repositories/case-storage.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

export interface CommitCaseResultView {
  id: number;
  exerciseCaseId: number;
  cputime: string;
  memused: number;
  outputType: number;
  status: number;
  statusMessage: string | null;
  error: string | null;
  /** The program's own output on this case — null when the exercise case
   * hides it (show_user_output=false) and the requester isn't staff. */
  output: string | null;
  /** Expected input/output from the exercise case itself (S3) — same
   * visibility rule, per-field (show_input / show_expected_output). */
  expectedInput: string | null;
  expectedOutput: string | null;
}

/** Mirrors CommitsExerciseCasesController — per-test-case results for one
 * commit, with the same staff-vs-student visibility rules as the
 * exercise case itself (ExerciseCaseService). */
export class CommitCaseResultService {
  constructor(
    private readonly commits: CommitRepository,
    private readonly exercises: ExerciseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly results: CommitCaseResultRepository,
    private readonly caseStorage: CaseStorageRepository,
  ) {}

  async listForCommit(commitId: number, requester: Requester): Promise<CommitCaseResultView[]> {
    const commit = await this.commits.findById(commitId);
    if (!commit) throw new NotFoundError("Commit not found");

    const isAdmin = requester.type >= UserType.ADMIN;
    const isOwner = commit.userEmail === requester.email;
    const exercise = await this.exercises.findById(commit.exerciseId);
    const isStaff =
      isAdmin || (exercise !== null && (await this.enrollments.isStaff(requester.email, exercise.offeringId)));

    if (!isOwner && !isStaff) throw new ForbiddenError();

    const rows = await this.results.listForCommit(commitId);

    return Promise.all(
      rows.map(async (row) => {
        const showOutput = isStaff || (row.showUserOutput ?? false);
        const showInput = isStaff || (row.showInput ?? false);
        const showExpected = isStaff || (row.showExpectedOutput ?? false);

        const [expectedInput, expectedOutput] = await Promise.all([
          showInput ? this.caseStorage.getInput(row.exerciseCaseId).catch(() => null) : Promise.resolve(null),
          showExpected
            ? this.caseStorage.getOutput(row.exerciseCaseId).catch(() => null)
            : Promise.resolve(null),
        ]);

        return {
          id: row.id,
          exerciseCaseId: row.exerciseCaseId,
          cputime: row.cputime,
          memused: row.memused,
          outputType: row.outputType,
          status: row.status,
          statusMessage: row.statusMessage,
          error: row.error,
          output: showOutput ? row.output : null,
          expectedInput,
          expectedOutput,
        };
      }),
    );
  }
}
