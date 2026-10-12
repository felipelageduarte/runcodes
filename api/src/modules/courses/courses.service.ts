import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export interface ListCoursesParams {
  universityId?: number;
  code?: string;
  title?: string;
  page: number;
  pageSize: number;
}

export async function listCourses(params: ListCoursesParams) {
  const where: Prisma.coursesWhereInput = {
    ...(params.universityId !== undefined ? { university_id: params.universityId } : {}),
    ...(params.code ? { code: { contains: params.code, mode: "insensitive" } } : {}),
    ...(params.title ? { title: { contains: params.title, mode: "insensitive" } } : {}),
  };

  const [total, courses] = await Promise.all([
    prisma.courses.count({ where }),
    prisma.courses.findMany({
      where,
      orderBy: { university_id: "asc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ]);

  return { total, page: params.page, pageSize: params.pageSize, courses };
}

export async function getCourse(id: number) {
  return prisma.courses.findUnique({ where: { id } });
}

/**
 * Mirrors CakePHP CoursesController::coursesList() — a lightweight search
 * used to populate "pick a course" dropdowns when creating an offering.
 * Scoped to the caller's own university; the legacy test course is hidden.
 */
export async function searchCourses(universityId: number, search?: string) {
  const courses = await prisma.courses.findMany({
    where: {
      university_id: universityId,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      NOT: { title: "RUN0001 - Run Codes Test" },
    },
    orderBy: { title: "asc" },
    select: { id: true, title: true, code: true },
  });
  return courses;
}
