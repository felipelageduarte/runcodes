import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { ExerciseService } from "../../services/exercise.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { requireMinType } from "../middleware/requireMinType.js";
import { UserType } from "../../lib/constants.js";

const listQuerySchema = z.object({
  university: z.coerce.number().int().optional(),
  title: z.string().optional(),
  // 1 = closed, 2 = open, 3 = future. Omitted = open (legacy default).
  status: z.coerce.number().int().min(1).max(3).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function dateRangeFor(status: 1 | 2 | 3 | undefined) {
  const now = new Date();
  if (status === 1) return { deadlineBefore: now };
  if (status === 3) return { openAfter: now, deadlineAfter: now };
  return { openBefore: now, deadlineAfter: now }; // default + status 2 (open)
}

export function createExercisesRouter(exerciseService: ExerciseService, requireAuth: RequestHandler) {
  const router = Router();

  // Admin-only global catalog, mirrors ExercisesController::index().
  router.get("/", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      const q = listQuerySchema.parse(req.query);
      const status = q.status as 1 | 2 | 3 | undefined;
      res.json(
        await exerciseService.list({
          universityId: q.university,
          title: q.title,
          dateRange: dateRangeFor(status),
          page: q.page,
          pageSize: q.pageSize,
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await exerciseService.getDetail(id, req.user!));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
