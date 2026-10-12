import { prisma } from "../../lib/prisma.js";
import { EnrollmentRole } from "../../lib/constants.js";

export async function isEnrolled(email: string, offeringId: number): Promise<boolean> {
  const count = await prisma.enrollments.count({
    where: { user_email: email, offering_id: offeringId, banned: false },
  });
  return count > 0;
}

export async function isEnrolledAsProfessorOrAssistant(
  email: string,
  offeringId: number,
): Promise<boolean> {
  const count = await prisma.enrollments.count({
    where: {
      user_email: email,
      offering_id: offeringId,
      banned: false,
      role: { in: [EnrollmentRole.PROFESSOR, EnrollmentRole.ASSISTANT] },
    },
  });
  return count > 0;
}

/** Offerings a user is enrolled in, still open (end_date > now). */
export async function getOfferingsByUser(
  email: string,
  onlyProfessorOrAssistant = false,
): Promise<number[]> {
  const rows = await prisma.enrollments.findMany({
    where: {
      user_email: email,
      banned: false,
      ...(onlyProfessorOrAssistant ? { role: { gt: EnrollmentRole.STUDENT } } : {}),
      offerings: { end_date: { gt: new Date() } },
    },
    select: { offering_id: true },
  });
  return rows.map((r) => r.offering_id);
}
