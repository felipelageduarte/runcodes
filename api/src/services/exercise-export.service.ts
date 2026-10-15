import { ZipArchive, type Archiver } from "archiver";
import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { CommitRepository } from "../repositories/commit.repository.js";
import type { StorageRepository } from "../repositories/storage.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

function extensionOf(key: string): string {
  const parts = key.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/** Mirrors ExercisesController::getAllScoresZipped() — a ZIP of each
 * enrolled student's most recent submission file, one folder per
 * student. Legacy builds the zip on local disk then re-uploads it to S3
 * just to redirect the browser to a pre-signed URL; this streams it
 * straight back in the HTTP response instead. */
export class ExerciseExportService {
  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly commits: CommitRepository,
    private readonly storage: StorageRepository,
    private readonly users: UserRepository,
  ) {}

  async buildLatestSubmissionsZip(
    exerciseId: number,
    requester: Requester,
  ): Promise<{ filename: string; archive: Archiver }> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");

    const isAdmin = requester.type >= UserType.ADMIN;
    if (!isAdmin && !(await this.enrollments.isStaff(requester.email, exercise.offeringId))) {
      throw new ForbiddenError();
    }

    const latestCommits = await this.commits.listLatestPerStudentForExercise(exerciseId);
    const archive = new ZipArchive();
    archive.append(
      `Generated: ${new Date().toISOString()}\nContains the latest submission from each student at the time of generation.\nExercise: ${exercise.title}`,
      { name: "README.txt" },
    );

    for (const commit of latestCommits) {
      if (!commit.awsKey) continue;
      const user = await this.users.findByEmail(commit.userEmail);
      const label = user?.identifier ? `${user.identifier}-${user.name}` : commit.userEmail;
      const ext = extensionOf(commit.awsKey);
      const content = await this.storage.getCommitFile(commit.awsKey);
      archive.append(Buffer.from(content), { name: `${label}/${label}${ext ? `.${ext}` : ""}` });
    }

    void archive.finalize();
    return { filename: `${exercise.title.replace(/[^a-zA-Z0-9-_]/g, "_")}.zip`, archive };
  }
}
