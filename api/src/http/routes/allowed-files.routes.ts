import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { AllowedFileService } from "../../services/allowed-file.service.js";
import { requireMinType } from "../middleware/requireMinType.js";
import { UserType } from "../../lib/constants.js";

const listQuerySchema = z.object({
  compilable: z.coerce.boolean().optional(),
  includeUnavailable: z.coerce.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  extension: z.string().min(1),
  compilable: z.boolean(),
  compileCommand: z.string().nullable().default(null),
  runCommand: z.string().nullable().default(null),
});

const updateSchema = createSchema.partial().extend({ available: z.boolean().optional() });

export function createAllowedFilesRouter(allowedFileService: AllowedFileService, requireAuth: RequestHandler) {
  const router = Router();

  // Open to any authenticated user — populating an exercise-creation form.
  router.get("/", requireAuth, async (req, res, next) => {
    try {
      const q = listQuerySchema.parse(req.query);
      res.json(await allowedFileService.list(q));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", requireAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await allowedFileService.getById(id));
    } catch (err) {
      next(err);
    }
  });

  router.post("/", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      const input = createSchema.parse(req.body);
      res.status(201).json(await allowedFileService.create(input));
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      const input = updateSchema.parse(req.body);
      res.json(await allowedFileService.update(id, input));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
