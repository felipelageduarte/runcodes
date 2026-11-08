import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { DbAdminService } from "../../services/db-admin.service.js";
import { requirePermission } from "../middleware/requirePermission.js";

const querySchema = z.object({
  sql: z.string().min(1),
  confirm: z.boolean().optional().default(false),
});

export function createDbAdminRouter(dbAdminService: DbAdminService, requireAuth: RequestHandler) {
  const router = Router();
  router.use(requireAuth, requirePermission("admin.db:query"));

  router.get("/health", async (_req, res, next) => {
    try {
      res.json(await dbAdminService.health());
    } catch (err) {
      next(err);
    }
  });

  router.get("/schema", async (_req, res, next) => {
    try {
      res.json(await dbAdminService.schema());
    } catch (err) {
      next(err);
    }
  });

  router.post("/query", async (req, res, next) => {
    try {
      const { sql, confirm } = querySchema.parse(req.body);
      res.json(await dbAdminService.runQuery(sql, confirm));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
