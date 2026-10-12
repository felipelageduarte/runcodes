import { prisma } from "../../lib/prisma.js";
import { EnrollmentRole } from "../../lib/constants.js";

async function attachProfessors<T extends { id: number }>(offerings: T[]) {
  const ids = offerings.map((o) => o.id);
  if (ids.length === 0) return offerings.map((o) => ({ ...o, professors: [] as string[] }));

  const enrollments = await prisma.enrollments.findMany({
    where: { offering_id: { in: ids }, role: EnrollmentRole.PROFESSOR, banned: false },
    select: { offering_id: true, users: { select: { name: true, email: true } } },
  });

  const byOffering = new Map<number, { name: string; email: string }[]>();
  for (const e of enrollments) {
    const list = byOffering.get(e.offering_id) ?? [];
    list.push(e.users);
    byOffering.set(e.offering_id, list);
  }

  return offerings.map((o) => ({
    ...o,
    professors: (byOffering.get(o.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

async function withCourseAndUniversity<T extends { course_id: number }>(offerings: T[]) {
  const courseIds = [...new Set(offerings.map((o) => o.course_id))];
  const courses = await prisma.courses.findMany({ where: { id: { in: courseIds } } });
  const coursesById = new Map(courses.map((c) => [c.id, c]));

  const universityIds = [...new Set(courses.map((c) => c.university_id))];
  const universities = await prisma.universities.findMany({ where: { id: { in: universityIds } } });
  const universitiesById = new Map(universities.map((u) => [u.id, u]));

  return offerings.map((o) => {
    const course = coursesById.get(o.course_id) ?? null;
    const university = course ? (universitiesById.get(course.university_id) ?? null) : null;
    return { ...o, course, university };
  });
}

export interface ListOfferingsParams {
  closed: boolean;
  universityId?: number;
  page: number;
  pageSize: number;
}

// Mirrors OfferingsController::index().
export async function listOfferings(params: ListOfferingsParams) {
  const now = new Date();
  const where = {
    end_date: params.closed ? { lte: now } : { gt: now },
    ...(params.universityId !== undefined
      ? { courses: { university_id: params.universityId } }
      : {}),
  };

  const [total, offerings] = await Promise.all([
    prisma.offerings.count({ where }),
    prisma.offerings.findMany({
      where,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { end_date: "asc" },
    }),
  ]);

  const enriched = await attachProfessors(await withCourseAndUniversity(offerings));
  return { total, page: params.page, pageSize: params.pageSize, offerings: enriched };
}

// Mirrors OfferingsController::my().
export async function listMyOfferings(email: string) {
  const enrollments = await prisma.enrollments.findMany({
    where: { user_email: email, banned: false },
    select: { offering_id: true, role: true },
  });
  const roleByOffering = new Map(enrollments.map((e) => [e.offering_id, e.role]));
  const offeringIds = [...roleByOffering.keys()];
  if (offeringIds.length === 0) return { open: [], closed: [] };

  const offerings = await prisma.offerings.findMany({ where: { id: { in: offeringIds } } });
  const enriched = await withCourseAndUniversity(offerings);
  const withRole = enriched.map((o) => ({ ...o, myRole: roleByOffering.get(o.id)! }));

  const now = new Date();
  return {
    open: withRole.filter((o) => o.end_date > now),
    closed: withRole.filter((o) => o.end_date <= now),
  };
}

// Mirrors OfferingsController::view(): staff see every non-removed exercise,
// students only ones already open (or explicitly flagged visible early).
export async function getOfferingDetail(offeringId: number, isStaff: boolean) {
  const offering = await prisma.offerings.findUnique({ where: { id: offeringId } });
  if (!offering) return null;

  const [[withCourse], members] = await Promise.all([
    withCourseAndUniversity([offering]),
    prisma.enrollments.findMany({
      where: {
        offering_id: offeringId,
        banned: false,
        role: { in: [EnrollmentRole.PROFESSOR, EnrollmentRole.ASSISTANT] },
      },
      select: { role: true, users: { select: { name: true, email: true } } },
    }),
  ]);

  const exercises = await prisma.exercises.findMany({
    where: {
      offering_id: offeringId,
      removed: false,
      ...(isStaff
        ? {}
        : { OR: [{ open_date: { lt: new Date() } }, { show_before_opening: true }] }),
    },
    orderBy: [{ deadline: "asc" }, { title: "asc" }],
    select: { id: true, title: true, deadline: true, open_date: true, show_before_opening: true, type: true },
  });

  return {
    ...withCourse,
    professors: members.filter((m) => m.role === EnrollmentRole.PROFESSOR).map((m) => m.users),
    assistants: members.filter((m) => m.role === EnrollmentRole.ASSISTANT).map((m) => m.users),
    exercises,
  };
}
