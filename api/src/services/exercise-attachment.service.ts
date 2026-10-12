import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { AttachmentRepository, AttachmentRecord } from "../repositories/attachment.repository.js";
import type { AttachmentStorageRepository } from "../repositories/attachment-storage.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

// Mirrors the legacy's download-time block on exercisefiles/compilationfiles
// (exe/php/htm/html), moved to upload time instead: there's no point
// accepting a file we'll never agree to serve back.
const BLOCKED_EXTENSIONS = new Set(["exe", "php", "htm", "html"]);

function extensionOf(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export interface AttachmentContent {
  filename: string;
  content: Uint8Array;
}

/**
 * Shared implementation behind both exercise-file and compilation-file
 * attachments (ExercisesFilesController / CompilationFilesController) —
 * same CRUD shape, same authorization rule, only the repository/storage
 * pair differs. The container instantiates this twice.
 */
export class ExerciseAttachmentService {
  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly attachments: AttachmentRepository,
    private readonly storage: AttachmentStorageRepository,
  ) {}

  private async requireStaffOrAdmin(offeringId: number, requester: Requester): Promise<void> {
    if (requester.type >= UserType.ADMIN) return;
    if (await this.enrollments.isStaff(requester.email, offeringId)) return;
    throw new ForbiddenError();
  }

  private async requireAccess(exerciseId: number, requester: Requester) {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");

    const isAdmin = requester.type >= UserType.ADMIN;
    const isStaff = isAdmin || (await this.enrollments.isStaff(requester.email, exercise.offeringId));
    if (!isStaff && !(await this.enrollments.isEnrolled(requester.email, exercise.offeringId))) {
      throw new ForbiddenError();
    }
    return exercise;
  }

  async list(exerciseId: number, requester: Requester): Promise<AttachmentRecord[]> {
    const exercise = await this.requireAccess(exerciseId, requester);
    // Attachments live on the real exercise, same as cases — a ghost's
    // list must redirect there too, not just uploads.
    const targetExerciseId = exercise.ghost && exercise.realId ? exercise.realId : exercise.id;
    return this.attachments.listForExercise(targetExerciseId);
  }

  async upload(
    exerciseId: number,
    requester: Requester,
    file: { filename: string; content: Buffer },
  ): Promise<AttachmentRecord> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");
    await this.requireStaffOrAdmin(exercise.offeringId, requester);

    if (BLOCKED_EXTENSIONS.has(extensionOf(file.filename))) {
      throw new ValidationError(`File type not allowed: .${extensionOf(file.filename)}`, "file_type_not_allowed");
    }

    // Ghost exercises share attachments with the real exercise, same as
    // cases and allowed file types.
    const targetExerciseId = exercise.ghost && exercise.realId ? exercise.realId : exercise.id;

    await this.storage.put(targetExerciseId, file.filename, file.content);
    try {
      return await this.attachments.create(targetExerciseId, file.filename);
    } catch (err) {
      await this.storage.delete(targetExerciseId, file.filename).catch(() => {});
      throw err;
    }
  }

  async getContent(attachmentId: number, requester: Requester): Promise<AttachmentContent> {
    const attachment = await this.attachments.findById(attachmentId);
    if (!attachment) throw new NotFoundError("Attachment not found");
    await this.requireAccess(attachment.exerciseId, requester);

    const content = await this.storage.get(attachment.exerciseId, attachment.path);
    return { filename: attachment.path, content };
  }

  async delete(attachmentId: number, requester: Requester): Promise<void> {
    const attachment = await this.attachments.findById(attachmentId);
    if (!attachment) throw new NotFoundError("Attachment not found");

    const exercise = await this.exercises.findById(attachment.exerciseId);
    if (!exercise) throw new NotFoundError("Exercise not found");
    await this.requireStaffOrAdmin(exercise.offeringId, requester);

    if (!(await this.attachments.delete(attachmentId))) throw new NotFoundError("Attachment not found");
    await this.storage.delete(attachment.exerciseId, attachment.path).catch(() => {});
  }
}
