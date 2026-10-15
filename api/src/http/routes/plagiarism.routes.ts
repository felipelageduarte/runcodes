import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { PlagiarismService } from "../../services/plagiarism.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

const requestSchema = z.object({ provider: z.enum(["dolos", "jplag"]) });

export function createPlagiarismRouters(plagiarismService: PlagiarismService, requireAuth: RequestHandler) {
  // Mounted at /api/exercises/:exerciseId/plagiarism-runs
  const exerciseRuns = Router({ mergeParams: true });

  exerciseRuns.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      const { provider } = requestSchema.parse(req.body);
      const run = await plagiarismService.requestRun(exerciseId, provider, req.user!);
      res.status(202).json(run);
    } catch (err) {
      next(err);
    }
  });

  exerciseRuns.get("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      res.json(await plagiarismService.listForExercise(exerciseId, req.user!));
    } catch (err) {
      next(err);
    }
  });

  // Mounted at /api/plagiarism-runs
  const runs = Router();

  runs.get("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await plagiarismService.getRun(id, req.user!));
    } catch (err) {
      next(err);
    }
  });

  return { exerciseRuns, runs };
}
