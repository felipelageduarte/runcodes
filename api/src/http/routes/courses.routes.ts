import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { CourseService } from "../../services/course.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { requireMinType } from "../middleware/requireMinType.js";
import { UserType } from "../../lib/constants.js";

const listQuerySchema = z.object({
  university: z.coerce.number().int().optional(),
  code: z.string().optional(),
  title: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const searchQuerySchema = z.object({ q: z.string().optional() });

const createSchema = z.object({
  code: z.string().min(1).max(16),
  title: z.string().min(1).max(255),
  universityId: z.number().int(),
});

export function createCoursesRouter(courseService: CourseService, requireAuth: RequestHandler) {
  const router = Router();

  // Admin-only global catalog, mirrors CoursesController::index/view.
  router.get("/", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      const q = listQuerySchema.parse(req.query);
      res.json(await courseService.list(q));
    } catch (err) {
      next(err);
    }
  });

  // Admin-only — mirrors CoursesController::add() (single-course form, not the batch textarea).
  router.post("/", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      const input = createSchema.parse(req.body);
      const course = await courseService.create(input);
      res.status(201).json(course);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      res.json(await courseService.getById(Number(req.params.id)));
    } catch (err) {
      next(err);
    }
  });

  // Mirrors CoursesController::coursesList(): professors/assistants+
  // picking a course for their own university.
  router.get(
    "/search/mine",
    requireAuth,
    requireMinType(UserType.PROFESSOR),
    async (req: AuthedRequest, res, next) => {
      try {
        const { q } = searchQuerySchema.parse(req.query);
        res.json(await courseService.searchForUser(req.user!.email, q));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
