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

  router.get("/export.csv", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const offeringId = Number(req.params.offeringId);
      if (!Number.isInteger(offeringId)) return res.status(400).json({ error: "invalid_id" });
      const { filename, csv } = await gradesService.exportCsv(offeringId, req.user!);
      const safeFilename = filename.replace(/[\r\n"]/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(csv);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
