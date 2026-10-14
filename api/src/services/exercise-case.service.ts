import { createHash } from "node:crypto";
import { ZipArchive, type Archiver } from "archiver";
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

    // Cases live on the real exercise, same as attachments and
    // casesCount — a ghost's own id never has case rows of its own.
    const casesExerciseId = exercise.ghost && exercise.realId ? exercise.realId : exercise.id;
    return this.cases.listForExercise(casesExerciseId);
  }

  /** Shared by createCase/createBatch once the exercise is already
   * resolved, authorized and type-checked — one DB insert + the two S3
   * writes, rolling back the row if either write fails. */
  private async createOneCase(targetExerciseId: number, input: CreateCaseInput): Promise<ExerciseCaseRecord> {
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

  private async resolveTargetExercise(exerciseId: number, requester: Requester) {
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
    return exercise.ghost && exercise.realId ? exercise.realId : exercise.id;
  }

  /** Mirrors ExerciseCasesController::add(). */
  async createCase(
    exerciseId: number,
    requester: Requester,
    input: CreateCaseInput,
  ): Promise<ExerciseCaseRecord> {
    const targetExerciseId = await this.resolveTargetExercise(exerciseId, requester);
    return this.createOneCase(targetExerciseId, input);
  }

  /** Mirrors ExerciseCasesController::addBatch() — several cases at once,
   * sharing the same visibility/limit config. The legacy version matches
   * uploaded `.in`/`.out` file pairs by filename; this one takes the
   * input/output text directly instead, since it's an API, not a form
   * upload — same productivity gain (no one-by-one case creation), simpler
   * contract. Stops at the first failure — cases created before it stay
   * created (no transaction across S3 writes), the error says how many. */
  async createBatch(
    exerciseId: number,
    requester: Requester,
    inputs: CreateCaseInput[],
  ): Promise<ExerciseCaseRecord[]> {
    const targetExerciseId = await this.resolveTargetExercise(exerciseId, requester);

    const created: ExerciseCaseRecord[] = [];
    for (const input of inputs) {
      created.push(await this.createOneCase(targetExerciseId, input));
    }
    return created;
  }

  /** Toggle show_input/show_expected_output/show_user_output for every
   * case of the exercise at once — no equivalent before the paridade
   * audit (docs/roadmap/gap-audit-2026-10.md item 17), only per-case
   * toggling existed. */
  async setVisibilityForAll(
    exerciseId: number,
    requester: Requester,
    patch: { showInput?: boolean; showExpectedOutput?: boolean; showUserOutput?: boolean },
  ): Promise<{ count: number }> {
    const targetExerciseId = await this.resolveTargetExercise(exerciseId, requester);
    const count = await this.cases.updateVisibilityForExercise(targetExerciseId, patch);
    return { count };
  }

  /** Mirrors ExerciseCasesController::removeAllCases() — deletes every
   * case of the exercise; best-effort cleanup of their S3 objects. */
  async removeAllCases(exerciseId: number, requester: Requester): Promise<{ count: number }> {
    const targetExerciseId = await this.resolveTargetExercise(exerciseId, requester);
    const existing = await this.cases.listForExercise(targetExerciseId);

    const count = await this.cases.deleteAllForExercise(targetExerciseId);
    await Promise.all(existing.map((c) => this.storage.deleteCase(c.id).catch(() => {})));
    return { count };
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

  /** Mirrors ExercisesController::downloadCases() — zip of input/output
   * for every case, numbered `1.in`/`1.out`/`2.in`/... Staff/admin get
   * everything; a student only gets the `.in`/`.out` of cases whose
   * `showInput`/`showExpectedOutput` flag lets them see that content
   * (same as what `listForExercise` would've let them view one at a
   * time). Achado na auditoria de paridade de out/2026, item 18. */
  async buildCasesZip(
    exerciseId: number,
    requester: Requester,
  ): Promise<{ filename: string; archive: Archiver }> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");

    const isAdmin = requester.type >= UserType.ADMIN;
    const isStaff = isAdmin || (await this.enrollments.isStaff(requester.email, exercise.offeringId));
    if (!isStaff && !(await this.enrollments.isEnrolled(requester.email, exercise.offeringId))) {
      throw new ForbiddenError();
    }

    const casesExerciseId = exercise.ghost && exercise.realId ? exercise.realId : exercise.id;
    const cases = await this.cases.listForExercise(casesExerciseId);

    const archive = new ZipArchive();
    const info = isStaff
      ? `Arquivo zip gerado em: ${new Date().toLocaleString("pt-BR")}\nContém todos os casos de teste cadastrados até o momento, disponível apenas para professores/monitores.\nExercício: ${exercise.title}`
      : `Arquivo zip gerado em: ${new Date().toLocaleString("pt-BR")}\nContém os casos de teste disponibilizados pelo professor aos alunos.\nExercício: ${exercise.title}`;
    archive.append(info, { name: "README.txt" });

    let n = 1;
    for (const c of cases) {
      if (isStaff || c.showInput) {
        archive.append(await this.storage.getInput(c.id), { name: `${n}.in` });
      }
      if (isStaff || c.showExpectedOutput) {
        archive.append(await this.storage.getOutput(c.id), { name: `${n}.out` });
      }
      n++;
    }

    void archive.finalize();
    return { filename: `Casos de Teste - ${exercise.title.replace(/[^a-zA-Z0-9-_ ]/g, "_")}.zip`, archive };
  }
}
