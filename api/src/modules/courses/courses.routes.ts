import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/requireAuth.js";
import { requireMinType } from "../../middleware/requireMinType.js";
import { UserType } from "../../lib/constants.js";
import { prisma } from "../../lib/prisma.js";
import { listCourses, getCourse, searchCourses } from "./courses.service.js";

export const coursesRouter = Router();

const listQuerySchema = z.object({
  university: z.coerce.number().int().optional(),
  code: z.string().optional(),
  title: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Admin-only global catalog, mirrors CoursesController::index/view.
coursesRouter.get("/", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);
    const result = await listCourses({
      universityId: q.university,
      code: q.code,
      title: q.title,
      page: q.page,
      pageSize: q.pageSize,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

coursesRouter.get("/:id", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const course = await getCourse(id);
    if (!course) return res.status(404).json({ error: "not_found" });
    res.json(course);
  } catch (err) {
    next(err);
  }
});

const searchQuerySchema = z.object({ q: z.string().optional() });

// Mirrors CoursesController::coursesList() — professors/assistants+ picking
// a course for their own university when creating an offering.
coursesRouter.get(
  "/search/mine",
  requireAuth,
  requireMinType(UserType.PROFESSOR),
  async (req: AuthedRequest, res, next) => {
    try {
      const { q } = searchQuerySchema.parse(req.query);
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
        select: { universityId: true },
      });
      if (!user?.universityId) return res.json([]);
      const courses = await searchCourses(user.universityId, q);
      res.json(courses);
    } catch (err) {
      next(err);
    }
  },
);
