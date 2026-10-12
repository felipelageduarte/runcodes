import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { OfferingService } from "../../services/offering.service.js";
import type { OfferingMembershipService } from "../../services/offering-membership.service.js";
import { EnrollmentRole } from "../../repositories/enrollment.repository.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

const listQuerySchema = z.object({
  closed: z.coerce.boolean().default(false),
  university: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const setRoleSchema = z.object({
  role: z.union([
    z.literal(EnrollmentRole.STUDENT),
    z.literal(EnrollmentRole.ASSISTANT),
    z.literal(EnrollmentRole.PROFESSOR),
  ]),
});

export function createOfferingsRouter(
  offeringService: OfferingService,
  membershipService: OfferingMembershipService,
  requireAuth: RequestHandler,
) {
  const router = Router();

  // Open to any authenticated user — mirrors OfferingsController::index().
  router.get("/", requireAuth, async (req, res, next) => {
    try {
      const q = listQuerySchema.parse(req.query);
      res.json(await offeringService.list(q));
    } catch (err) {
      next(err);
    }
  });

  router.get("/mine", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      res.json(await offeringService.listMine(req.user!.email));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await offeringService.getDetail(id, req.user!));
    } catch (err) {
      next(err);
    }
  });

  // Staff (or admin) promotes/demotes a member — mirrors
  // OfferingsController::setProfessor/setAssistant/setStudent().
  router.put("/:id/members/:email/role", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      const { role } = setRoleSchema.parse(req.body);

      const updated =
        role === EnrollmentRole.PROFESSOR
          ? await membershipService.setProfessor(id, req.params.email, req.user!)
          : role === EnrollmentRole.ASSISTANT
            ? await membershipService.setAssistant(id, req.params.email, req.user!)
            : await membershipService.setStudent(id, req.params.email, req.user!);

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Admin-only — mirrors OfferingsController::ban().
  router.post("/:id/members/:email/ban", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.json(await membershipService.ban(id, req.params.email, req.user!));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
