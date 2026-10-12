import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { UniversityService } from "../../services/university.service.js";
import { requireMinType } from "../middleware/requireMinType.js";
import { UserType } from "../../lib/constants.js";

const createSchema = z.object({
  abbreviation: z.string().min(2).max(15),
  name: z.string().min(1),
  studentIdentifierText: z.string().nullable().default(null),
  type: z.number().int().nullable().default(null),
  state: z.string().nullable().default(null),
});

const updateSchema = createSchema.partial();

export function createUniversitiesRouter(universityService: UniversityService, requireAuth: RequestHandler) {
  const router = Router();

  // Public — a signup form needs this before the user has an account.
  router.get("/", async (_req, res, next) => {
    try {
      res.json(await universityService.list());
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await universityService.getById(id));
    } catch (err) {
      next(err);
    }
  });

  router.post("/", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      const input = createSchema.parse(req.body);
      res.status(201).json(await universityService.create(input));
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      const input = updateSchema.parse(req.body);
      res.json(await universityService.update(id, input));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
