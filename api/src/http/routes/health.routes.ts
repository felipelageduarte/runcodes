import { Router, type RequestHandler } from "express";
import type { AuthedRequest } from "../middleware/requireAuth.js";

export function createHealthRouter(requireAuth: RequestHandler) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", now: new Date().toISOString() });
  });

  router.get("/me", requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.user });
  });

  return router;
}
