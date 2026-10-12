import type { OfferingRepository } from "../repositories/offering.repository.js";
import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { CommitRepository } from "../repositories/commit.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

export interface StudentGrade {
  studentEmail: string;
  score: string | null;
  status: number | null;
  commitId: number | null;
}

export interface ExerciseGrades {
  exerciseId: number;
  title: string;
  deadline: Date;
  grades: StudentGrade[];
}

export interface GradesView {
  students: { email: string; name: string }[];
  exercises: ExerciseGrades[];
}

/** Mirrors OfferingsController::grades() — the per-exercise, per-student
 * score matrix. Reuses CommitRepository.listLatestPerStudentForExercise,
 * the same "latest commit per student" query the plagiarism worker uses —
 * same semantics as the legacy's commit_time=MAX subquery. */
export class GradesService {
  constructor(
    private readonly offerings: OfferingRepository,
    private readonly exercises: ExerciseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly commits: CommitRepository,
  ) {}

  async getGrades(offeringId: number, requester: Requester): Promise<GradesView> {
    const offering = await this.offerings.findById(offeringId);
    if (!offering) throw new NotFoundError("Offering not found");

    const isAdmin = requester.type >= UserType.ADMIN;
    if (!isAdmin && !(await this.enrollments.isStaff(requester.email, offeringId))) {
      throw new ForbiddenError();
    }

    const [exercises, students] = await Promise.all([
      this.exercises.listVisible({ offeringId, includeUnopened: true }),
      this.enrollments.listStudentsForOffering(offeringId),
    ]);

    const exerciseGrades = await Promise.all(
      exercises.map(async (exercise): Promise<ExerciseGrades> => {
        const commits = await this.commits.listLatestPerStudentForExercise(exercise.id);
        const byStudent = new Map(commits.map((c) => [c.userEmail, c]));

        return {
          exerciseId: exercise.id,
          title: exercise.title,
          deadline: exercise.deadline,
          grades: students.map((student) => {
            const commit = byStudent.get(student.email);
            return {
              studentEmail: student.email,
              score: commit?.score ?? null,
              status: commit?.status ?? null,
              commitId: commit?.id ?? null,
            };
          }),
        };
      }),
    );

    return { students, exercises: exerciseGrades };
  }
}
