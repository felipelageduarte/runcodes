import { createHash, randomUUID } from "node:crypto";
import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { CommitRepository } from "../repositories/commit.repository.js";
import type { StorageRepository } from "../repositories/storage.repository.js";
import { CommitStatus, CompilableExerciseTypes, UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

const COMPILABLE_MAX_SIZE = 1_000_000;
const NON_COMPILABLE_MAX_SIZE = 5_000_000;

export interface SubmitCommitInput {
  exerciseId: number;
  requester: Requester;
  ip: string | null;
  file: { originalname: string; buffer: Buffer };
}

function extensionOf(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.slice(1).join(".").toLowerCase() : "";
}

export class CommitService {
  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly commits: CommitRepository,
    private readonly storage: StorageRepository,
  ) {}

  private async checkAccess(exerciseOfferingId: number, requester: Requester) {
    const isAdmin = requester.type >= UserType.ADMIN;
    const isStaff = isAdmin || (await this.enrollments.isStaff(requester.email, exerciseOfferingId));
    if (!isStaff && !(await this.enrollments.isEnrolled(requester.email, exerciseOfferingId))) {
      throw new ForbiddenError();
    }
    return { isStaff };
  }

  /** Mirrors ExercisesController::commit() — the submission flow. */
  async submit(input: SubmitCommitInput) {
    const exercise = await this.exercises.findById(input.exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");

    const { isStaff } = await this.checkAccess(exercise.offeringId, input.requester);

    const now = new Date();
    const isOpen = exercise.openDate !== null && exercise.openDate <= now && exercise.deadline > now;
    if (!isOpen && !isStaff) {
      throw new ValidationError("This exercise is closed to new submissions", "exercise_closed");
    }

    const allowed = await this.exercises.findAllowedExtensions(
      exercise.ghost ? (exercise.realId ?? exercise.id) : exercise.id,
    );
    const ext = extensionOf(input.file.originalname);
    if (allowed.length > 0 && !allowed.includes(ext)) {
      throw new ValidationError("This file type is not allowed for this exercise", "file_type_not_allowed");
    }

    const isCompilable = CompilableExerciseTypes.includes(exercise.type);
    const maxSize = isCompilable ? COMPILABLE_MAX_SIZE : NON_COMPILABLE_MAX_SIZE;
    if (input.file.buffer.length > maxSize) {
      throw new ValidationError("File exceeds the size limit for this exercise", "file_too_large");
    }

    const key = `${exercise.id}/${randomUUID()}-${input.file.originalname}`;
    await this.storage.putCommitFile(key, input.file.buffer);
    const hash = createHash("sha1").update(input.file.buffer).digest("hex");

    return this.commits.create({
      userEmail: input.requester.email,
      exerciseId: exercise.id,
      status: isCompilable ? CommitStatus.IN_QUEUE : CommitStatus.SUBMITTED,
      hash,
      awsKey: key,
      ip: input.ip,
    });
  }

  async listForUser(exerciseId: number, requester: Requester) {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");
    await this.checkAccess(exercise.offeringId, requester);
    return this.commits.listForUserOnExercise(exerciseId, requester.email);
  }

  async getById(id: number, requester: Requester) {
    const commit = await this.commits.findById(id);
    if (!commit) throw new NotFoundError("Commit not found");

    const isAdmin = requester.type >= UserType.ADMIN;
    if (!isAdmin && commit.userEmail !== requester.email) {
      const exercise = await this.exercises.findById(commit.exerciseId);
      const isStaff =
        exercise !== null && (await this.enrollments.isStaff(requester.email, exercise.offeringId));
      if (!isStaff) throw new ForbiddenError();
    }

    return commit;
  }
}
