import type { ExerciseRepository, ListExercisesFilter } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

export class ExerciseService {
  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly enrollments: EnrollmentRepository,
  ) {}

  /** Mirrors ExercisesController::index() — admin-only global catalog. */
  async list(filter: ListExercisesFilter) {
    const { total, exercises } = await this.exercises.list(filter);
    return { total, page: filter.page, pageSize: filter.pageSize, exercises };
  }

  /** Mirrors ExercisesController::view()/viewProfessor(), minus the
   * commit/case grading detail (that's CommitService's job). */
  async getDetail(id: number, requester: Requester) {
    const exercise = await this.exercises.findById(id);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");

    const isAdmin = requester.type >= UserType.ADMIN;
    const isStaff = isAdmin || (await this.enrollments.isStaff(requester.email, exercise.offeringId));
    if (!isStaff && !(await this.enrollments.isEnrolled(requester.email, exercise.offeringId))) {
      throw new ForbiddenError();
    }

    const now = new Date();
    const isOpen =
      exercise.openDate !== null && exercise.openDate <= now && exercise.deadline > now;
    if (!isStaff && !isOpen && !exercise.showBeforeOpening) {
      throw new NotFoundError("Exercise not found");
    }

    // Ghost exercises redirect to the real exercise for cases/files/
    // allowed-files — same rule as everywhere else this comes up
    // (commit submission, case CRUD, attachments).
    const targetId = exercise.ghost && exercise.realId ? exercise.realId : exercise.id;
    const [casesCount, allowedFiles, offering] = await Promise.all([
      this.exercises.countCases(targetId),
      this.exercises.listAllowedFiles(targetId),
      // Contexto da turma (nome da disciplina, sala) — a tela de
      // exercício precisa se situar sem uma segunda request.
      this.exercises.findOfferingContext(exercise.offeringId),
    ]);
    return { ...exercise, isOpen, casesCount, allowedFiles, offering };
  }

  /** Resolves the offering an exercise belongs to, for access-control
   * checks that happen before the exercise's full visibility is known
   * (e.g. a commit submission). Throws if the exercise is gone/removed. */
  async requireOfferingId(exerciseId: number): Promise<number> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");
    return exercise.offeringId;
  }
}
