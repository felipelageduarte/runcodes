import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type {
  PublicExerciseRepository,
  PublicExerciseRecord,
} from "../repositories/public-exercise.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

/** Mirrors PublicExercisesController — any professor+ (not just staff of
 * the exercise's own offering, matching the legacy's global
 * type >= professorIndex check) can mark an exercise reusable. */
export class PublicExerciseService {
  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly publicExercises: PublicExerciseRepository,
  ) {}

  async publish(
    exerciseId: number,
    requester: Requester,
    input: { level: number; obs: string | null; keywords: string | null },
  ): Promise<PublicExerciseRecord> {
    if (requester.type < UserType.PROFESSOR) throw new ForbiddenError();

    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");

    if (await this.publicExercises.findByExerciseId(exerciseId)) {
      throw new ConflictError("This exercise was already published before", "already_published");
    }

    return this.publicExercises.create({ exerciseId, ...input });
  }

  async list(page: number, pageSize: number, requester: Requester) {
    if (requester.type < UserType.PROFESSOR) throw new ForbiddenError();
    const { total, entries } = await this.publicExercises.list(page, pageSize);
    return { total, page, pageSize, entries };
  }
}
