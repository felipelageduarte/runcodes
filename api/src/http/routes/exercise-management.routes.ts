import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { ExerciseManagementService } from "../../services/exercise-management.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  deadline: z.coerce.date(),
  openDate: z.coerce.date().nullable().default(null),
  type: z.number().int().min(0).max(2),
  showBeforeOpening: z.boolean().default(false),
  markdown: z.boolean().default(false),
  allowedFileIds: z.array(z.number().int()).default([]),
});

const updateSchema = createSchema.partial();

export function createExerciseManagementRouters(
  managementService: ExerciseManagementService,
  requireAuth: RequestHandler,
) {
  // Mounted at /api/offerings/:offeringId/exercises
  const offeringExercises = Router({ mergeParams: true });

  offeringExercises.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const offeringId = Number(req.params.offeringId);
      if (!Number.isInteger(offeringId)) return res.status(400).json({ error: "invalid_id" });
      const input = createSchema.parse(req.body);
      const exercise = await managementService.createExercise(offeringId, req.user!, input);
      res.status(201).json(exercise);
    } catch (err) {
      next(err);
    }
  });

  // Mounted at /api/exercises (alongside the read-only routes)
  const exercises = Router();

  exercises.put("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      const input = updateSchema.parse(req.body);
      const exercise = await managementService.updateExercise(id, req.user!, input);
      res.json(exercise);
    } catch (err) {
      next(err);
    }
  });

  exercises.delete("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      await managementService.deleteExercise(id, req.user!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return { offeringExercises, exercises };
}
