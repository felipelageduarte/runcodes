import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/requireAuth.js";
import { UserType } from "../../lib/constants.js";
import { isEnrolled, isEnrolledAsProfessorOrAssistant } from "../enrollments/enrollment.service.js";
import { listOfferings, listMyOfferings, getOfferingDetail } from "./offerings.service.js";

export const offeringsRouter = Router();

const listQuerySchema = z.object({
  closed: z.coerce.boolean().default(false),
  university: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Open to any authenticated user — mirrors OfferingsController::index().
offeringsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);
    const result = await listOfferings({
      closed: q.closed,
      universityId: q.university,
      page: q.page,
      pageSize: q.pageSize,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

offeringsRouter.get("/mine", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const result = await listMyOfferings(req.user!.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

offeringsRouter.get("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });

    const { email, type } = req.user!;
    const isAdmin = type >= UserType.ADMIN;
    const isStaff = isAdmin || (await isEnrolledAsProfessorOrAssistant(email, id));
    if (!isAdmin && !isStaff && !(await isEnrolled(email, id))) {
      return res.status(403).json({ error: "forbidden" });
    }

    const offering = await getOfferingDetail(id, isStaff);
    if (!offering) return res.status(404).json({ error: "not_found" });
    res.json(offering);
  } catch (err) {
    next(err);
  }
});
