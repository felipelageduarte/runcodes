import { prisma } from "../../lib/prisma.js";

export async function findOfferingIdForExercise(id: number): Promise<number | null> {
  const row = await prisma.exercises.findUnique({
    where: { id },
    select: { offering_id: true, removed: true },
  });
  if (!row || row.removed) return null;
  return row.offering_id;
}

export interface ListExercisesParams {
  universityId?: number;
  title?: string;
  /** 1 = closed, 2 = open, 3 = future. Omitted = open (legacy default). */
  status?: 1 | 2 | 3;
  page: number;
  pageSize: number;
}

// Mirrors ExercisesController::index() — admin-only global catalog.
export async function listExercises(params: ListExercisesParams) {
  const now = new Date();
  const dateConditions =
    params.status === 1
      ? { deadline: { lte: now } }
      : params.status === 3
        ? { open_date: { gt: now }, deadline: { gt: now } }
        : { open_date: { lte: now }, deadline: { gt: now } }; // default + status 2 (open)

  const where = {
    ...dateConditions,
    ...(params.title ? { title: { contains: params.title, mode: "insensitive" as const } } : {}),
    ...(params.universityId !== undefined
      ? { offerings: { courses: { university_id: params.universityId } } }
      : {}),
  };

  const [total, exercises] = await Promise.all([
    prisma.exercises.count({ where }),
    prisma.exercises.findMany({
      where,
      orderBy: { deadline: "asc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: { id: true, title: true, open_date: true, deadline: true, offering_id: true, removed: true },
    }),
  ]);

  return { total, page: params.page, pageSize: params.pageSize, exercises };
}

// Mirrors ExercisesController::view()/viewProfessor() minus commit/case
// grading details (that lands with the commits module).
export async function getExerciseDetail(id: number, isStaff: boolean) {
  const exercise = await prisma.exercises.findUnique({ where: { id } });
  if (!exercise || exercise.removed) return null;

  const isOpen =
    exercise.open_date !== null &&
    exercise.open_date <= new Date() &&
    exercise.deadline > new Date();

  if (!isStaff && !isOpen && !exercise.show_before_opening) {
    return "not_visible" as const;
  }

  const casesCount = await prisma.exercise_cases.count({ where: { exercise_id: id } });

  return { ...exercise, isOpen, casesCount };
}
