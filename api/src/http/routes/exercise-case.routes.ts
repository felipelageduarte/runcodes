import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { ExerciseCaseService } from "../../services/exercise-case.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

const createSchema = z.object({
  input: z.string(),
  output: z.string(),
  outputType: z.number().int().min(1).max(3),
  showInput: z.boolean().default(false),
  showExpectedOutput: z.boolean().default(false),
  showUserOutput: z.boolean().default(false),
  cputime: z.number().int().min(1),
  maxmemsize: z.number().int().optional(),
  stacksize: z.number().int().optional(),
  absError: z.number().nullable().optional(),
});

const updateSchema = createSchema.partial();

export function createExerciseCaseRouters(caseService: ExerciseCaseService, requireAuth: RequestHandler) {
  // Mounted at /api/exercises/:exerciseId/cases
  const exerciseCases = Router({ mergeParams: true });

  exerciseCases.get("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      res.json(await caseService.listForExercise(exerciseId, req.user!));
    } catch (err) {
      next(err);
    }
  });

  exerciseCases.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      const input = createSchema.parse(req.body);
      const created = await caseService.createCase(exerciseId, req.user!, input);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // Mounted at /api/exercise-cases
  const cases = Router();

  cases.put("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      const input = updateSchema.parse(req.body);
      res.json(await caseService.updateCase(id, req.user!, input));
    } catch (err) {
      next(err);
    }
  });

  cases.delete("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      await caseService.deleteCase(id, req.user!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return { exerciseCases, cases };
}
