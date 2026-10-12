import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/requireAuth.js";
import { prisma } from "../../lib/prisma.js";
import { EnrollmentRole } from "../../lib/constants.js";

export const enrollmentsRouter = Router();

const enrollSchema = z.object({ enrollment_code: z.string().min(1) });

// Mirrors EnrollmentsController::add() — self-enroll via a classroom code.
enrollmentsRouter.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { enrollment_code } = enrollSchema.parse(req.body);
    const { email } = req.user!;

    const offering = await prisma.offerings.findFirst({
      where: { enrollment_code: enrollment_code.toUpperCase() },
      select: { id: true, course_id: true },
    });
    if (!offering) return res.status(404).json({ error: "invalid_enrollment_code" });

    const course = await prisma.courses.findUnique({
      where: { id: offering.course_id },
      select: { university_id: true },
    });
    const user = await prisma.user.findUnique({ where: { email }, select: { universityId: true } });
    if (course && user?.universityId !== null && course.university_id !== user?.universityId) {
      return res.status(403).json({ error: "wrong_university" });
    }

    const existing = await prisma.enrollments.findUnique({
      where: { offering_id_user_email: { offering_id: offering.id, user_email: email } },
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: existing.banned ? "banned_from_offering" : "already_enrolled" });
    }

    const enrollment = await prisma.enrollments.create({
      data: { offering_id: offering.id, user_email: email, role: EnrollmentRole.STUDENT },
    });
    res.status(201).json(enrollment);
  } catch (err) {
    next(err);
  }
});

enrollmentsRouter.get("/mine", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const enrollments = await prisma.enrollments.findMany({
      where: { user_email: req.user!.email, banned: false },
    });
    res.json(enrollments);
  } catch (err) {
    next(err);
  }
});
