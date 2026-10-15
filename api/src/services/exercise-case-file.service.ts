import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { ExerciseCaseRepository } from "../repositories/exercise-case.repository.js";
import type {
  ExerciseCaseFileRepository,
  ExerciseCaseFileRecord,
} from "../repositories/exercise-case-file.repository.js";
import type { CaseStorageRepository } from "../repositories/case-storage.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

export interface CaseFileContent {
  filename: string;
  content: Uint8Array;
}

/**
 * File-based test case input — mirrors ExerciseCaseFilesController, minus
 * its two-phase "upload to a temp key, then attach on case save" dance
 * (an artifact of the legacy jQuery file-upload widget). Here upload is
 * one request, straight into the case's own S3 slot
 * (`{caseId}/files/{filename}` in the `cases` bucket — runcodes-compiler's
 * fetch_test_case_files() already reads this shape).
 *
 * Staff/admin-only throughout: unlike exercise/compilation files, a
 * case's input files are grading material, not something students see.
 */
export class ExerciseCaseFileService {
  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly cases: ExerciseCaseRepository,
    private readonly caseFiles: ExerciseCaseFileRepository,
    private readonly storage: CaseStorageRepository,
  ) {}

  private async requireStaffOrAdmin(exerciseCaseId: number, requester: Requester) {
    const exerciseCase = await this.cases.findById(exerciseCaseId);
    if (!exerciseCase) throw new NotFoundError("Exercise case not found");
    const exercise = await this.exercises.findById(exerciseCase.exerciseId);
    if (!exercise) throw new NotFoundError("Exercise not found");

    const isAdmin = requester.type >= UserType.ADMIN;
    if (!isAdmin && !(await this.enrollments.isStaff(requester.email, exercise.offeringId))) {
      throw new ForbiddenError();
    }
    return exerciseCase;
  }

  async list(exerciseCaseId: number, requester: Requester): Promise<ExerciseCaseFileRecord[]> {
    await this.requireStaffOrAdmin(exerciseCaseId, requester);
    return this.caseFiles.listForCase(exerciseCaseId);
  }

  async upload(
    exerciseCaseId: number,
    requester: Requester,
    file: { filename: string; content: Buffer },
  ): Promise<ExerciseCaseFileRecord> {
    await this.requireStaffOrAdmin(exerciseCaseId, requester);

    await this.storage.putFile(exerciseCaseId, file.filename, file.content);
    try {
      return await this.caseFiles.create(exerciseCaseId, file.filename);
    } catch (err) {
      await this.storage.deleteFile(exerciseCaseId, file.filename).catch(() => {});
      throw err;
    }
  }

  async getContent(caseFileId: number, requester: Requester): Promise<CaseFileContent> {
    const caseFile = await this.caseFiles.findById(caseFileId);
    if (!caseFile) throw new NotFoundError("Exercise case file not found");
    await this.requireStaffOrAdmin(caseFile.exerciseCaseId, requester);

    const content = await this.storage.getFile(caseFile.exerciseCaseId, caseFile.path);
    return { filename: caseFile.path, content };
  }

  async delete(caseFileId: number, requester: Requester): Promise<void> {
    const caseFile = await this.caseFiles.findById(caseFileId);
    if (!caseFile) throw new NotFoundError("Exercise case file not found");
    await this.requireStaffOrAdmin(caseFile.exerciseCaseId, requester);

    if (!(await this.caseFiles.delete(caseFileId))) throw new NotFoundError("Exercise case file not found");
    await this.storage.deleteFile(caseFile.exerciseCaseId, caseFile.path).catch(() => {});
  }
}
