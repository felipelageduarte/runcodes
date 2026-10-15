import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { MessageService } from "../../services/message.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { requireMinType } from "../middleware/requireMinType.js";
import { UserType } from "../../lib/constants.js";

const sendSchema = z.object({
  audience: z.enum(["students", "staff", "admins", "all"]),
  subject: z.string().min(1).max(200),
  message: z.string().min(1),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function createMessagesRouter(messageService: MessageService, requireAuth: RequestHandler) {
  const router = Router();

  // Admin-only — mirrors MessagesController::sendMail().
  router.post("/", requireAuth, requireMinType(UserType.ADMIN), async (req: AuthedRequest, res, next) => {
    try {
      const input = sendSchema.parse(req.body);
      const message = await messageService.send(req.user!, input);
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  });

  router.get("/", requireAuth, requireMinType(UserType.ADMIN), async (req: AuthedRequest, res, next) => {
    try {
      const { page, pageSize } = listQuerySchema.parse(req.query);
      res.json(await messageService.list(page, pageSize, req.user!));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
