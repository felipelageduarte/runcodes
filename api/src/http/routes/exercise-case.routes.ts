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

const batchSchema = z.object({ cases: z.array(createSchema).min(1).max(200) });

const visibilitySchema = z.object({
  showInput: z.boolean().optional(),
  showExpectedOutput: z.boolean().optional(),
  showUserOutput: z.boolean().optional(),
});

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

  exerciseCases.get("/download.zip", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      const { filename, archive } = await caseService.buildCasesZip(exerciseId, req.user!);
      const safeFilename = filename.replace(/[\r\n"]/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.setHeader("Content-Type", "application/zip");
      archive.on("error", next);
      archive.pipe(res);
    } catch (err) {
      next(err);
    }
  });

  exerciseCases.post("/batch", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      const { cases } = batchSchema.parse(req.body);
      const created = await caseService.createBatch(exerciseId, req.user!, cases);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  exerciseCases.put("/visibility", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      const patch = visibilitySchema.parse(req.body);
      res.json(await caseService.setVisibilityForAll(exerciseId, req.user!, patch));
    } catch (err) {
      next(err);
    }
  });

  exerciseCases.delete("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      res.json(await caseService.removeAllCases(exerciseId, req.user!));
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
