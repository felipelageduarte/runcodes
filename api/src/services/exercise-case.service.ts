import { createHash } from "node:crypto";
import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type {
  ExerciseCaseRepository,
  ExerciseCaseRecord,
} from "../repositories/exercise-case.repository.js";
import type { CaseStorageRepository } from "../repositories/case-storage.repository.js";
import { UserType, NotCompilableExerciseType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

const DEFAULT_MAXMEMSIZE = 4096;
const DEFAULT_STACKSIZE = 2048;
const DEFAULT_FILE_SIZE = 10_000;

function md5(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

export interface CreateCaseInput {
  input: string;
  output: string;
  outputType: number;
  showInput: boolean;
  showExpectedOutput: boolean;
  showUserOutput: boolean;
  cputime: number;
  maxmemsize?: number;
  stacksize?: number;
  absError?: number | null;
}

export interface UpdateCaseInput {
  input?: string;
  output?: string;
  outputType?: number;
  showInput?: boolean;
  showExpectedOutput?: boolean;
  showUserOutput?: boolean;
  cputime?: number;
  maxmemsize?: number;
  stacksize?: number;
  absError?: number | null;
}

/** Exercise case (test case) CRUD — input/output text, stored in the S3
 * `cases` bucket at the exact key shape compiler-engine already reads. */
export class ExerciseCaseService {
  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly cases: ExerciseCaseRepository,
    private readonly storage: CaseStorageRepository,
  ) {}

  private async requireStaffOrAdmin(offeringId: number, requester: Requester): Promise<void> {
    if (requester.type >= UserType.ADMIN) return;
    if (await this.enrollments.isStaff(requester.email, offeringId)) return;
    throw new ForbiddenError();
  }

  /** Metadata only (flags, limits, hashes) — never the input/output content,
   * so this is safe for any enrolled member, not just staff. */
  async listForExercise(exerciseId: number, requester: Requester): Promise<ExerciseCaseRecord[]> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");

    const isAdmin = requester.type >= UserType.ADMIN;
    const isStaff = isAdmin || (await this.enrollments.isStaff(requester.email, exercise.offeringId));
    if (!isStaff && !(await this.enrollments.isEnrolled(requester.email, exercise.offeringId))) {
      throw new ForbiddenError();
    }

    return this.cases.listForExercise(exerciseId);
  }

  /** Mirrors ExerciseCasesController::add(). */
  async createCase(
    exerciseId: number,
    requester: Requester,
    input: CreateCaseInput,
  ): Promise<ExerciseCaseRecord> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");
    await this.requireStaffOrAdmin(exercise.offeringId, requester);

    if (exercise.type === NotCompilableExerciseType) {
      throw new ValidationError(
        "Exercise cases aren't supported for this exercise type",
        "cases_not_supported_for_exercise_type",
      );
    }

    // Ghost exercises are clones that share the original's cases — legacy
    // redirects case creation to the real exercise; do the same here.
    const targetExerciseId = exercise.ghost && exercise.realId ? exercise.realId : exercise.id;

    const created = await this.cases.create({
      exerciseId: targetExerciseId,
      outputType: input.outputType,
      showInput: input.showInput,
      showExpectedOutput: input.showExpectedOutput,
      showUserOutput: input.showUserOutput,
      cputime: input.cputime,
      maxmemsize: input.maxmemsize ?? DEFAULT_MAXMEMSIZE,
      stacksize: input.stacksize ?? DEFAULT_STACKSIZE,
      fileSize: DEFAULT_FILE_SIZE,
      absError: input.absError ?? null,
      inputMd5: md5(input.input),
      outputMd5: md5(input.output),
    });

    try {
      await Promise.all([
        this.storage.putInput(created.id, input.input),
        this.storage.putOutput(created.id, input.output),
      ]);
    } catch (err) {
      await this.cases.delete(created.id);
      throw err;
    }

    return created;
  }

  /** Mirrors ExerciseCasesController::edit(). */
  async updateCase(caseId: number, requester: Requester, input: UpdateCaseInput): Promise<ExerciseCaseRecord> {
    const existing = await this.cases.findById(caseId);
    if (!existing) throw new NotFoundError("Exercise case not found");
    const exercise = await this.exercises.findById(existing.exerciseId);
    if (!exercise) throw new NotFoundError("Exercise not found");
    await this.requireStaffOrAdmin(exercise.offeringId, requester);

    if (input.input !== undefined) {
      await this.storage.putInput(caseId, input.input);
    }
    if (input.output !== undefined) {
      await this.storage.putOutput(caseId, input.output);
    }

    const updated = await this.cases.update(caseId, {
      outputType: input.outputType,
      showInput: input.showInput,
      showExpectedOutput: input.showExpectedOutput,
      showUserOutput: input.showUserOutput,
      cputime: input.cputime,
      maxmemsize: input.maxmemsize,
      stacksize: input.stacksize,
      absError: input.absError,
      inputMd5: input.input !== undefined ? md5(input.input) : undefined,
      outputMd5: input.output !== undefined ? md5(input.output) : undefined,
    });
    if (!updated) throw new NotFoundError("Exercise case not found");
    return updated;
  }

  /** Mirrors ExerciseCasesController::delete(). */
  async deleteCase(caseId: number, requester: Requester): Promise<void> {
    const existing = await this.cases.findById(caseId);
    if (!existing) throw new NotFoundError("Exercise case not found");
    const exercise = await this.exercises.findById(existing.exerciseId);
    if (!exercise) throw new NotFoundError("Exercise not found");
    await this.requireStaffOrAdmin(exercise.offeringId, requester);

    const ok = await this.cases.delete(caseId);
    if (!ok) throw new NotFoundError("Exercise case not found");
    await this.storage.deleteCase(caseId).catch(() => {}); // best-effort, row is already gone
  }
}
