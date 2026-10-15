import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { AlertService } from "../../services/alert.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

const createSchema = z.object({
  type: z.number().int().min(0).max(3),
  offeringId: z.number().int().nullable(),
  recipients: z.number().int().min(0).max(2),
  valid: z.coerce.date(),
  title: z.string().min(1),
  message: z.string().min(1),
});

const updateSchema = createSchema.partial();

export function createAlertsRouter(alertService: AlertService, requireAuth: RequestHandler) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      const offeringId = req.query.offeringId ? Number(req.query.offeringId) : undefined;
      res.json(await alertService.listActive(offeringId));
    } catch (err) {
      next(err);
    }
  });

  router.get("/all", async (req: AuthedRequest, res, next) => {
    try {
      const page = Number(req.query.page) || 1;
      const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);
      res.json(await alertService.list(page, pageSize, req.user!));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await alertService.getById(id));
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req: AuthedRequest, res, next) => {
    try {
      const input = createSchema.parse(req.body);
      res.status(201).json(await alertService.create(req.user!, input));
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      const input = updateSchema.parse(req.body);
      res.json(await alertService.update(id, input, req.user!));
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      await alertService.delete(id, req.user!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
