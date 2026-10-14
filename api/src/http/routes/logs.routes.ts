import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { LogService } from "../../services/log.service.js";
import { requireMinType } from "../middleware/requireMinType.js";
import { UserType } from "../../lib/constants.js";

const filterSchema = {
  userEmail: z.string().optional(),
  ip: z.string().optional(),
  q: z.string().optional(),
  status: z.coerce.number().int().min(100).max(599).optional(),
};

const listQuerySchema = z.object({
  ...filterSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const statsQuerySchema = z.object(filterSchema);

export function createLogsRouter(logService: LogService, requireAuth: RequestHandler) {
  const router = Router();

  router.get("/", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      const q = listQuerySchema.parse(req.query);
      res.json(await logService.list(q));
    } catch (err) {
      next(err);
    }
  });

  router.get("/stats", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      const q = statsQuerySchema.parse(req.query);
      res.json(await logService.stats(q));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
