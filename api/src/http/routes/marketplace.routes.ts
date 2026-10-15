import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { MarketplaceService } from "../../services/marketplace.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

const searchQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).optional(),
  universityId: z.coerce.number().int().optional(),
  sortBy: z.enum(["name", "recent", "difficulty", "popularity"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function createMarketplaceRouter(marketplaceService: MarketplaceService, requireAuth: RequestHandler) {
  const router = Router();
  router.use(requireAuth);

  router.get("/exercises", async (req: AuthedRequest, res, next) => {
    try {
      const filter = searchQuerySchema.parse(req.query);
      res.json(await marketplaceService.search(filter, req.user!));
    } catch (err) {
      next(err);
    }
  });

  router.get("/exercises/:exerciseId", async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      res.json(await marketplaceService.getById(exerciseId, req.user!));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
