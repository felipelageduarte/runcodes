import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { TicketService } from "../../services/ticket.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

const createSchema = z.object({
  type: z.number().int().min(0).max(3),
  priority: z.number().int().min(0).max(4),
  message: z.string().min(1),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  status: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function createTicketsRouter(ticketService: TicketService, requireAuth: RequestHandler) {
  const router = Router();
  router.use(requireAuth);

  router.post("/", async (req: AuthedRequest, res, next) => {
    try {
      const input = createSchema.parse(req.body);
      res.status(201).json(await ticketService.create(req.user!, input));
    } catch (err) {
      next(err);
    }
  });

  router.get("/mine", async (req: AuthedRequest, res, next) => {
    try {
      res.json(await ticketService.listMine(req.user!));
    } catch (err) {
      next(err);
    }
  });

  router.get("/", async (req: AuthedRequest, res, next) => {
    try {
      const q = listQuerySchema.parse(req.query);
      res.json(await ticketService.list(q, req.user!));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await ticketService.getById(id, req.user!));
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      const input = updateSchema.parse(req.body);
      res.json(await ticketService.update(id, input, req.user!));
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id/solve", async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await ticketService.setSolved(id, req.user!));
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id/close", async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await ticketService.close(id, req.user!));
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      await ticketService.delete(id, req.user!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
