import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { AdminOverviewService, DEFAULT_STUCK_MINUTES } from "../../services/admin-overview.service.js";
import { requirePermission } from "../middleware/requirePermission.js";

const querySchema = z.object({
  /** Minutos em COMPILING/RUNNING a partir dos quais um commit conta
   * como preso. 1 min a 24 h; default 15. */
  stuckMinutes: z.coerce.number().int().min(1).max(1440).default(DEFAULT_STUCK_MINUTES),
});

/** GET /api/admin/overview — KPIs da home do admin. Permissão
 * `admin.overview:read` do catálogo. */
export function createAdminOverviewRouter(overviewService: AdminOverviewService, requireAuth: RequestHandler) {
  const router = Router();
  router.use(requireAuth, requirePermission("admin.overview:read"));

  router.get("/", async (req, res, next) => {
    try {
      const { stuckMinutes } = querySchema.parse(req.query);
      res.json(await overviewService.get(stuckMinutes));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
