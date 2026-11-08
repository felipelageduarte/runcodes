import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { PipelineService } from "../../services/pipeline.service.js";
import { requirePermission } from "../middleware/requirePermission.js";

const activeQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function createPipelineRouter(pipelineService: PipelineService, requireAuth: RequestHandler) {
  const router = Router();
  router.use(requireAuth, requirePermission("admin.pipeline:manage"));

  router.get("/stats", async (_req, res, next) => {
    try {
      res.json(await pipelineService.stats());
    } catch (err) {
      next(err);
    }
  });

  router.get("/active", async (req, res, next) => {
    try {
      const { limit } = activeQuerySchema.parse(req.query);
      res.json(await pipelineService.active(limit));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
