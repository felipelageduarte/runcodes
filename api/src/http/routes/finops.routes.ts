import { Router, type RequestHandler } from "express";
import type { FinopsService } from "../../services/finops.service.js";
import { requirePermission } from "../middleware/requirePermission.js";

/** Custo da AWS do RunCodes (Cost Explorer, com cache de 24 h).
 * Permissão `admin.finops:view`. */
export function createFinopsRouter(finopsService: FinopsService, requireAuth: RequestHandler) {
  const router = Router();
  router.use(requireAuth, requirePermission("admin.finops:view"));

  router.get("/", async (_req, res, next) => {
    try {
      res.json(await finopsService.get());
    } catch (err) {
      next(err);
    }
  });

  // Releitura manual; no máximo uma por hora (429 `refresh_too_soon`).
  router.post("/refresh", async (_req, res, next) => {
    try {
      res.json(await finopsService.refresh());
    } catch (err) {
      next(err);
    }
  });

  return router;
}
