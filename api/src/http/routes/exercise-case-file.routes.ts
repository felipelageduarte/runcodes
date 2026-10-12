import { Router, type RequestHandler } from "express";
import type { ExerciseCaseFileService } from "../../services/exercise-case-file.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { upload } from "../middleware/upload.js";

/** Same shape as exercise/compilation file attachments: nested router
 * for list+upload under the owning case, flat router for get+delete by
 * case-file id. */
export function createExerciseCaseFileRouters(service: ExerciseCaseFileService, requireAuth: RequestHandler) {
  const byCase = Router({ mergeParams: true });

  byCase.get("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseCaseId = Number(req.params.exerciseCaseId);
      if (!Number.isInteger(exerciseCaseId)) return res.status(400).json({ error: "invalid_id" });
      res.json(await service.list(exerciseCaseId, req.user!));
    } catch (err) {
      next(err);
    }
  });

  byCase.post("/", requireAuth, upload.single("file"), async (req: AuthedRequest, res, next) => {
    try {
      const exerciseCaseId = Number(req.params.exerciseCaseId);
      if (!Number.isInteger(exerciseCaseId)) return res.status(400).json({ error: "invalid_id" });
      if (!req.file) return res.status(400).json({ error: "missing_file" });

      const caseFile = await service.upload(exerciseCaseId, req.user!, {
        filename: req.file.originalname,
        content: req.file.buffer,
      });
      res.status(201).json(caseFile);
    } catch (err) {
      next(err);
    }
  });

  const byId = Router();

  byId.get("/:id/download", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      const { filename, content } = await service.getContent(id, req.user!);
      const safeFilename = filename.replace(/[\r\n"]/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      res.send(Buffer.from(content));
    } catch (err) {
      next(err);
    }
  });

  byId.delete("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      await service.delete(id, req.user!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return { byCase, byId };
}
