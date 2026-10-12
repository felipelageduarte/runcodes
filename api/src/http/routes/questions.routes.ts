import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { QuestionService } from "../../services/question.service.js";
import { requireMinType } from "../middleware/requireMinType.js";
import { UserType } from "../../lib/constants.js";

const createSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  tags: z.string().nullable().default(null),
});

const updateSchema = createSchema.partial();

export function createQuestionsRouter(questionService: QuestionService, requireAuth: RequestHandler) {
  const router = Router();

  // Public reads — mirrors the legacy Auth->allow('modal')/studentAuthorized.
  router.get("/", async (req, res, next) => {
    try {
      const page = Number(req.query.page) || 1;
      const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);
      res.json(await questionService.list(page, pageSize));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await questionService.getById(id));
    } catch (err) {
      next(err);
    }
  });

  router.post("/", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      res.status(201).json(await questionService.create(createSchema.parse(req.body)));
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await questionService.update(id, updateSchema.parse(req.body)));
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      await questionService.delete(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
