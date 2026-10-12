import type {
  ExerciseRepository,
  ExerciseRecord,
  ExercisePatch,
} from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { AllowedFileRepository } from "../repositories/allowed-file.repository.js";
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

  /** Mirrors ExercisesController::edit() (the Exercise fields themselves — file uploads stay out of scope). */
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
}
