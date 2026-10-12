import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { PublicExerciseService } from "../../services/public-exercise.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

const publishSchema = z.object({
  level: z.number().int().min(0),
  obs: z.string().nullable().default(null),
  keywords: z.string().nullable().default(null),
});

export function createPublicExercisesRouter(
  publicExerciseService: PublicExerciseService,
  requireAuth: RequestHandler,
) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req: AuthedRequest, res, next) => {
    try {
      const page = Number(req.query.page) || 1;
      const pageSize = Math.min(Number(req.query.pageSize) || 10, 100);
      res.json(await publicExerciseService.list(page, pageSize, req.user!));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:exerciseId", async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      const input = publishSchema.parse(req.body);
      res.status(201).json(await publicExerciseService.publish(exerciseId, req.user!, input));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
