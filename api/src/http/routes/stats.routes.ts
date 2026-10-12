import { Router, type RequestHandler } from "express";
import type { StatsService } from "../../services/stats.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

export function createExerciseStatsRouter(statsService: StatsService, requireAuth: RequestHandler) {
  const router = Router({ mergeParams: true });

  router.get("/stats", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      res.json(await statsService.getExerciseCaseStats(exerciseId, req.user!));
    } catch (err) {
      next(err);
    }
  });

  router.get("/participants/:userEmail/commits", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      res.json(
        await statsService.getParticipantCommits(exerciseId, req.params.userEmail, req.user!),
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createOfferingStatsRouter(statsService: StatsService, requireAuth: RequestHandler) {
  const router = Router({ mergeParams: true });

  router.get("/stats", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const offeringId = Number(req.params.offeringId);
      if (!Number.isInteger(offeringId)) return res.status(400).json({ error: "invalid_id" });
      const participantEmail =
        typeof req.query.participantEmail === "string" ? req.query.participantEmail : undefined;
      res.json(await statsService.getOfferingStats(offeringId, req.user!, participantEmail));
    } catch (err) {
      next(err);
    }
  });

  router.get("/infographic", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const offeringId = Number(req.params.offeringId);
      if (!Number.isInteger(offeringId)) return res.status(400).json({ error: "invalid_id" });
      res.json(await statsService.getOfferingInfographic(offeringId, req.user!));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
