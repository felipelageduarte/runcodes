import { Router, type RequestHandler } from "express";
import type { ExerciseExportService } from "../../services/exercise-export.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

export function createExerciseExportRouter(service: ExerciseExportService, requireAuth: RequestHandler) {
  const router = Router({ mergeParams: true });

  router.get("/export-submissions.zip", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      const { filename, archive } = await service.buildLatestSubmissionsZip(exerciseId, req.user!);
      const safeFilename = filename.replace(/[\r\n"]/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.setHeader("Content-Type", "application/zip");
      archive.on("error", next);
      archive.pipe(res);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
