import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { CommitService } from "../../services/commit.service.js";
import type { CommitCaseResultService } from "../../services/commit-case-result.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { upload } from "../middleware/upload.js";

const editScoreSchema = z.object({
  score: z.coerce.number().min(0).max(10),
  status: z.number().int().min(0).max(9),
});

// Mounted twice by the composition root: nested under
// /api/exercises/:exerciseId/commits for submission + history, and at
// /api/commits for polling a single commit by id.
export function createCommitsRouters(
  commitService: CommitService,
  commitCaseResultService: CommitCaseResultService,
  requireAuth: RequestHandler,
) {
  const exerciseCommits = Router({ mergeParams: true });

  exerciseCommits.post("/", requireAuth, upload.single("files"), async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      if (!req.file) return res.status(400).json({ error: "missing_file" });

      const commit = await commitService.submit({
        exerciseId,
        requester: req.user!,
        ip: req.ip ?? null,
        file: { originalname: req.file.originalname, buffer: req.file.buffer },
      });
      res.status(201).json(commit);
    } catch (err) {
      next(err);
    }
  });

  exerciseCommits.get("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      res.json(await commitService.listForUser(exerciseId, req.user!));
    } catch (err) {
      next(err);
    }
  });

  // Staff of the turma (or admin) — mirrors CommitsController::recompileAll().
  exerciseCommits.post("/recompile-all", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      res.json(await commitService.recompileAll(exerciseId, req.user!));
    } catch (err) {
      next(err);
    }
  });

  const commits = Router();

  commits.get("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await commitService.getById(id, req.user!));
    } catch (err) {
      next(err);
    }
  });

  // Mirrors the Monaco-preload gap tracked in docs/frontend/code-editor.md
  // — text content (not a binary download), for prefilling the editor
  // with the student's last submission.
  commits.get("/:id/content", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      const { filename, content } = await commitService.getContent(id, req.user!);
      res.json({ filename, content: Buffer.from(content).toString("utf-8") });
    } catch (err) {
      next(err);
    }
  });

  // Staff of the turma (or admin) — mirrors CommitsController::editScore().
  commits.put("/:id/score", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      const { score, status } = editScoreSchema.parse(req.body);
      res.json(await commitService.editScore(id, req.user!, { score: String(score), status }));
    } catch (err) {
      next(err);
    }
  });

  // Staff of the turma (or admin) — mirrors CommitsController::recompile().
  commits.post("/:id/recompile", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await commitService.recompile(id, req.user!));
    } catch (err) {
      next(err);
    }
  });

  commits.get("/:id/cases", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await commitCaseResultService.listForCommit(id, req.user!));
    } catch (err) {
      next(err);
    }
  });

  return { exerciseCommits, commits };
}
