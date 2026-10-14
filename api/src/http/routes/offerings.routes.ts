import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { OfferingService } from "../../services/offering.service.js";
import type { OfferingMembershipService } from "../../services/offering-membership.service.js";
import { EnrollmentRole } from "../../repositories/enrollment.repository.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { requireMinType } from "../middleware/requireMinType.js";
import { UserType } from "../../lib/constants.js";

const listQuerySchema = z.object({
  closed: z.coerce.boolean().default(false),
  university: z.coerce.number().int().optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  courseId: z.number().int(),
  classroom: z.string().max(45).nullable().default(null),
  endDate: z.coerce.date(),
});

const updateSchema = z.object({
  classroom: z.string().max(45).nullable().optional(),
  endDate: z.coerce.date().optional(),
});

const emailSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1),
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
      const { university, ...query } = listQuerySchema.parse(req.query);
      res.json(await offeringService.list({ ...query, universityId: university }));
    } catch (err) {
      next(err);
    }
  });

  // Professor+ opens a new turma — mirrors OfferingsController::add().
  router.post("/", requireAuth, requireMinType(UserType.PROFESSOR), async (req: AuthedRequest, res, next) => {
    try {
      const input = createSchema.parse(req.body);
      const offering = await offeringService.create(req.user!, input);
      res.status(201).json(offering);
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

  // Staff of this offering (or admin) edits end_date/classroom — mirrors
  // OfferingsController::edit() (same two whitelisted fields).
  router.put("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      const input = updateSchema.parse(req.body);
      res.json(await offeringService.update(id, req.user!, input));
    } catch (err) {
      next(err);
    }
  });

  // Staff of this offering (or admin) emails every non-banned member —
  // mirrors OfferingsController::email().
  router.post("/:id/email", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      const input = emailSchema.parse(req.body);
      res.json(await offeringService.emailMembers(id, req.user!, input));
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

  // Staff of this offering (or admin) matricula alguém diretamente —
  // mirrors EnrollmentsController::enroll().
  router.post("/:id/members/:email", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      res.status(201).json(await membershipService.enrollManually(id, req.params.email, req.user!));
    } catch (err) {
      next(err);
    }
  });

  // Staff of this offering (or admin) — hard delete, diferente de ban —
  // mirrors EnrollmentsController::delete().
  router.delete("/:id/members/:email", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
      await membershipService.unenroll(id, req.params.email, req.user!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
