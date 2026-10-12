import { Router, type RequestHandler } from "express";
import type { GradesService } from "../../services/grades.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

export function createGradesRouter(gradesService: GradesService, requireAuth: RequestHandler) {
  const router = Router({ mergeParams: true });

  router.get("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const offeringId = Number(req.params.offeringId);
      if (!Number.isInteger(offeringId)) return res.status(400).json({ error: "invalid_id" });
      res.json(await gradesService.getGrades(offeringId, req.user!));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
