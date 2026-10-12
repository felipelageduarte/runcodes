import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { EnrollmentService } from "../../services/enrollment.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

const enrollSchema = z.object({ enrollment_code: z.string().min(1) });

export function createEnrollmentsRouter(
  enrollmentService: EnrollmentService,
  requireAuth: RequestHandler,
) {
  const router = Router();

  // Mirrors EnrollmentsController::add() — self-enroll via a classroom code.
  router.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { enrollment_code } = enrollSchema.parse(req.body);
      const enrollment = await enrollmentService.enrollByCode(req.user!.email, enrollment_code);
      res.status(201).json(enrollment);
    } catch (err) {
      next(err);
    }
  });

  router.get("/mine", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      res.json(await enrollmentService.listMine(req.user!.email));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
