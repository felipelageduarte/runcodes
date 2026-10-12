import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { PlagiarismRunRepository, PlagiarismRunRecord } from "../repositories/plagiarism-run.repository.js";
import type { PlagiarismJobQueue } from "../repositories/plagiarism-job-queue.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

export type PlagiarismProviderName = "dolos" | "jplag";

export class PlagiarismService {
  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly runs: PlagiarismRunRepository,
    private readonly queue: PlagiarismJobQueue,
  ) {}

  private async requireStaffOrAdmin(offeringId: number, requester: Requester): Promise<void> {
    if (requester.type >= UserType.ADMIN) return;
    if (await this.enrollments.isStaff(requester.email, offeringId)) return;
    throw new ForbiddenError();
  }

  /** Enqueues a comparison run — the HTTP response doesn't wait for the
   * actual JPlag/Dolos process, which can take anywhere from seconds to
   * minutes. Caller polls getRun() for the result. */
  async requestRun(
    exerciseId: number,
    provider: PlagiarismProviderName,
    requester: Requester,
  ): Promise<PlagiarismRunRecord> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");
    await this.requireStaffOrAdmin(exercise.offeringId, requester);

    if (provider !== "dolos" && provider !== "jplag") {
      throw new ValidationError("Unknown plagiarism provider", "unknown_provider");
    }

    const run = await this.runs.create(exerciseId, provider, requester.email);
    await this.queue.enqueue({ runId: run.id });
    return run;
  }

  async getRun(runId: number, requester: Requester): Promise<PlagiarismRunRecord> {
    const run = await this.runs.findById(runId);
    if (!run) throw new NotFoundError("Plagiarism run not found");

    const exercise = await this.exercises.findById(run.exerciseId);
    if (exercise) {
      await this.requireStaffOrAdmin(exercise.offeringId, requester);
    }
    return run;
  }

  async listForExercise(exerciseId: number, requester: Requester): Promise<PlagiarismRunRecord[]> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");
    await this.requireStaffOrAdmin(exercise.offeringId, requester);

    return this.runs.listForExercise(exerciseId);
  }
}
