import { Router, type RequestHandler } from "express";
import type { ExerciseAttachmentService } from "../../services/exercise-attachment.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { upload } from "../middleware/upload.js";

/** Mounted twice by the composition root (exercise-files, compilation-files)
 * — same shape as commits/cases: nested router for list+upload under the
 * owning exercise, flat router for get/delete by attachment id. */
export function createExerciseAttachmentRouters(
  service: ExerciseAttachmentService,
  requireAuth: RequestHandler,
) {
  const byExercise = Router({ mergeParams: true });

  byExercise.get("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      res.json(await service.list(exerciseId, req.user!));
    } catch (err) {
      next(err);
    }
  });

  byExercise.post("/", requireAuth, upload.single("file"), async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      if (!req.file) return res.status(400).json({ error: "missing_file" });

      const attachment = await service.upload(exerciseId, req.user!, {
        filename: req.file.originalname,
        content: req.file.buffer,
      });
      res.status(201).json(attachment);
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
      // Strip anything that could break out of the quoted filename param
      // (CR/LF header injection, embedded quotes) — a stored filename is
      // attacker-controlled input (whatever the uploader named the file).
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

  return { byExercise, byId };
}
