import type {
  ExerciseRepository,
  ExerciseRecord,
  ExercisePatch,
} from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { AllowedFileRepository } from "../repositories/allowed-file.repository.js";
import type { PublicExerciseRepository } from "../repositories/public-exercise.repository.js";
import type { ExerciseCaseRepository } from "../repositories/exercise-case.repository.js";
import type { CaseStorageRepository } from "../repositories/case-storage.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

export interface CreateExerciseInput {
  title: string;
  description: string | null;
  deadline: Date;
  openDate: Date | null;
  type: number;
  showBeforeOpening: boolean;
  markdown: boolean;
  allowedFileIds: number[];
}

export interface UpdateExerciseInput extends Partial<Omit<CreateExerciseInput, "allowedFileIds">> {
  allowedFileIds?: number[];
}

/**
 * Exercise authoring (create/edit/delete) — split from ExerciseService
 * (read access for students/staff) the same way OfferingMembershipService
 * is split from EnrollmentService: different actors, different
 * authorization shape, same aggregate.
 */
export class ExerciseManagementService {
  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly allowedFiles: AllowedFileRepository,
    private readonly publicExercises: PublicExerciseRepository,
    private readonly exerciseCases: ExerciseCaseRepository,
    private readonly caseStorage: CaseStorageRepository,
  ) {}

  private async requireStaffOrAdmin(offeringId: number, requester: Requester): Promise<void> {
    if (requester.type >= UserType.ADMIN) return;
    if (await this.enrollments.isStaff(requester.email, offeringId)) return;
    throw new ForbiddenError();
  }

  private async validateAllowedFileIds(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.allowedFiles.findByIds(ids);
    if (found.length !== ids.length) {
      throw new ValidationError("One or more allowed file types don't exist", "invalid_allowed_file_id");
    }
  }

  /** Mirrors ExercisesController::add(). */
  async createExercise(
    offeringId: number,
    requester: Requester,
    input: CreateExerciseInput,
  ): Promise<ExerciseRecord> {
    await this.requireStaffOrAdmin(offeringId, requester);
    await this.validateAllowedFileIds(input.allowedFileIds);

    const exercise = await this.exercises.create({
      offeringId,
      title: input.title,
      description: input.description,
      deadline: input.deadline,
      openDate: input.openDate,
      type: input.type,
      showBeforeOpening: input.showBeforeOpening,
      markdown: input.markdown,
      userEmail: requester.email,
    });

    if (input.allowedFileIds.length > 0) {
      await this.exercises.setAllowedFiles(exercise.id, input.allowedFileIds);
    }

    return exercise;
  }

  /** Mirrors ExercisesController::edit() (the Exercise fields themselves — file attachments are ExerciseAttachmentService's job). */
  async updateExercise(
    exerciseId: number,
    requester: Requester,
    input: UpdateExerciseInput,
  ): Promise<ExerciseRecord> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");
    await this.requireStaffOrAdmin(exercise.offeringId, requester);

    if (input.allowedFileIds) {
      await this.validateAllowedFileIds(input.allowedFileIds);
      await this.exercises.setAllowedFiles(exerciseId, input.allowedFileIds);
    }

    const patch: ExercisePatch = {
      title: input.title,
      description: input.description,
      deadline: input.deadline,
      openDate: input.openDate,
      type: input.type,
      showBeforeOpening: input.showBeforeOpening,
      markdown: input.markdown,
    };
    const updated = await this.exercises.update(exerciseId, patch);
    if (!updated) throw new NotFoundError("Exercise not found");
    return updated;
  }

  /** Mirrors ExercisesController::delete() — soft delete, cascades to ghost clones. */
  async deleteExercise(exerciseId: number, requester: Requester): Promise<void> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");
    await this.requireStaffOrAdmin(exercise.offeringId, requester);

    const ok = await this.exercises.softDelete(exercise.ghost && exercise.realId ? exercise.realId : exerciseId);
    if (!ok) throw new NotFoundError("Exercise not found");
  }

  /**
   * Mirrors Exercise::createGhostExercise() — shares an exercise into
   * another turma as a lightweight clone (ghost=true, real_id pointing
   * back to the original). Cases, allowed file types, and attachments
   * all stay on the real exercise; every other module that reads an
   * exercise's cases/files already redirects through real_id for a
   * ghost. Requires staff/admin of the *target* offering (where the
   * clone lands), matching the legacy check exactly — not staff of the
   * original exercise's own offering.
   *
   * Also requires the SOURCE to be legitimately shareable: either
   * published to the marketplace (public_exercises), or the requester
   * is already staff/admin of the source's own offering (no new access,
   * just doing manually what they could already do). Without this, any
   * staff of any turma could clone any exercise in the system knowing
   * only its id — true before the marketplace existed, but the
   * marketplace turns that into a real leak by publishing and
   * advertising ids, making neighboring private ids trivial to guess
   * and clone (docs/frontend/marketplace.md, gap #7).
   */
  async shareToOffering(
    exerciseId: number,
    targetOfferingId: number,
    requester: Requester,
  ): Promise<ExerciseRecord> {
    await this.requireStaffOrAdmin(targetOfferingId, requester);

    const source = await this.exercises.findById(exerciseId);
    if (!source || source.removed) throw new NotFoundError("Exercise not found");
    const realId = source.ghost && source.realId ? source.realId : source.id;
    const real = realId === source.id ? source : await this.exercises.findById(realId);
    if (!real || real.removed) throw new NotFoundError("Exercise not found");

    const isAdmin = requester.type >= UserType.ADMIN;
    if (!isAdmin) {
      const [isPublic, isSourceStaff] = await Promise.all([
        this.publicExercises.findByExerciseId(real.id).then((row) => row !== null),
        this.enrollments.isStaff(requester.email, real.offeringId),
      ]);
      if (!isPublic && !isSourceStaff) throw new ForbiddenError();
    }

    return this.exercises.create({
      offeringId: targetOfferingId,
      title: real.title,
      description: real.description,
      deadline: real.deadline,
      openDate: real.openDate,
      type: real.type,
      showBeforeOpening: real.showBeforeOpening ?? false,
      markdown: real.markdown ?? false,
      userEmail: requester.email,
      ghost: true,
      realId: real.id,
    });
  }

  /**
   * Clones an exercise as an independent copy — different from
   * `shareToOffering`'s ghost (which keeps pointing back at the
   * original): this one duplicates the cases themselves, so the new
   * exercise can be edited/graded without touching the source. Found in
   * the paridade audit (docs/roadmap/gap-audit-2026-10.md item 16) —
   * the legacy equivalent reuses an exercise's own cases/attachments as
   * a starting point for a new one in the same or another turma.
   *
   * Scope cut on purpose: clones the exercise's fields, allowed file
   * types, and test cases (text content, re-hashed). Exercise/
   * compilation file attachments are NOT cloned — same authoring
   * effort either way to re-attach a PDF/data file, and doing it here
   * would mean streaming every attachment through S3 twice for a case
   * that's rare relative to cloning cases (which is the actual
   * productivity pain this closes).
   */
  async cloneExercise(
    exerciseId: number,
    targetOfferingId: number,
    requester: Requester,
  ): Promise<ExerciseRecord> {
    await this.requireStaffOrAdmin(targetOfferingId, requester);

    const source = await this.exercises.findById(exerciseId);
    if (!source || source.removed) throw new NotFoundError("Exercise not found");
    const realId = source.ghost && source.realId ? source.realId : source.id;
    const real = realId === source.id ? source : await this.exercises.findById(realId);
    if (!real || real.removed) throw new NotFoundError("Exercise not found");

    const isAdmin = requester.type >= UserType.ADMIN;
    if (!isAdmin) {
      const [isPublic, isSourceStaff] = await Promise.all([
        this.publicExercises.findByExerciseId(real.id).then((row) => row !== null),
        this.enrollments.isStaff(requester.email, real.offeringId),
      ]);
      if (!isPublic && !isSourceStaff) throw new ForbiddenError();
    }

    const [allowedFiles, cases] = await Promise.all([
      this.exercises.listAllowedFiles(real.id),
      this.exerciseCases.listForExercise(real.id),
    ]);

    const clone = await this.exercises.create({
      offeringId: targetOfferingId,
      title: `${real.title} (cópia)`,
      description: real.description,
      deadline: real.deadline,
      openDate: real.openDate,
      type: real.type,
      showBeforeOpening: real.showBeforeOpening ?? false,
      markdown: real.markdown ?? false,
      userEmail: requester.email,
    });

    if (allowedFiles.length > 0) {
      await this.exercises.setAllowedFiles(
        clone.id,
        allowedFiles.map((f) => f.id),
      );
    }

    for (const c of cases) {
      const [input, output] = await Promise.all([
        this.caseStorage.getInput(c.id),
        this.caseStorage.getOutput(c.id),
      ]);
      const newCase = await this.exerciseCases.create({
        exerciseId: clone.id,
        outputType: c.outputType,
        showInput: c.showInput ?? false,
        showExpectedOutput: c.showExpectedOutput ?? false,
        showUserOutput: c.showUserOutput ?? false,
        cputime: c.cputime,
        maxmemsize: c.maxmemsize,
        stacksize: c.stacksize,
        fileSize: c.fileSize,
        absError: c.absError,
        inputMd5: c.inputMd5 ?? "",
        outputMd5: c.outputMd5 ?? "",
      });
      await Promise.all([
        this.caseStorage.putInput(newCase.id, input),
        this.caseStorage.putOutput(newCase.id, output),
      ]);
    }

    return clone;
  }
}
