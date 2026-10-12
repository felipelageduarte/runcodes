import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { LogService } from "../../services/log.service.js";
import { requireMinType } from "../middleware/requireMinType.js";
import { UserType } from "../../lib/constants.js";

const listQuerySchema = z.object({
  userEmail: z.string().optional(),
  ip: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

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

  return router;
}
