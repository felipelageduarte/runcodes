import { Router, type RequestHandler } from "express";
import { z } from "zod";
import {
  AUDIT_FEED_MAX_LIMIT,
  AUDIT_STATS_MAX_DAYS,
  type AuditService,
} from "../../services/audit.service.js";
import { requirePermission } from "../middleware/requirePermission.js";

const feedQuerySchema = z.object({
  actor: z.string().trim().min(1).optional(),
  method: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]))
    .optional(),
  status: z.coerce.number().int().min(100).max(599).optional(),
  route: z.string().trim().min(1).optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(AUDIT_FEED_MAX_LIMIT).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const statsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(AUDIT_STATS_MAX_DAYS).default(7),
});

/** `GET /api/admin/audit/feed` e `GET /api/admin/audit/stats`. Permissão
 * `admin.audit:read` do catálogo (dado sensível: request de toda a
 * plataforma). */
export function createAuditRouter(auditService: AuditService, requireAuth: RequestHandler) {
  const router = Router();
  router.use(requireAuth, requirePermission("admin.audit:read"));

  router.get("/feed", async (req, res, next) => {
    try {
      res.json(await auditService.feed(feedQuerySchema.parse(req.query)));
    } catch (err) {
      next(err);
    }
  });

  router.get("/stats", async (req, res, next) => {
    try {
      const { days } = statsQuerySchema.parse(req.query);
      res.json(await auditService.stats(days));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
