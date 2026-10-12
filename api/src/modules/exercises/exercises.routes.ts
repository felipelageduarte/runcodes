import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/requireAuth.js";
import { requireMinType } from "../../middleware/requireMinType.js";
import { UserType } from "../../lib/constants.js";
import { isEnrolled, isEnrolledAsProfessorOrAssistant } from "../enrollments/enrollment.service.js";
import { listExercises, getExerciseDetail, findOfferingIdForExercise } from "./exercises.service.js";

export const exercisesRouter = Router();

const listQuerySchema = z.object({
  university: z.coerce.number().int().optional(),
  title: z.string().optional(),
  status: z.coerce.number().int().min(1).max(3).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Admin-only global catalog, mirrors ExercisesController::index().
exercisesRouter.get("/", requireAuth, requireMinType(UserType.ADMIN), async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);
    const result = await listExercises({
      universityId: q.university,
      title: q.title,
      status: q.status as 1 | 2 | 3 | undefined,
      page: q.page,
      pageSize: q.pageSize,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

exercisesRouter.get("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });

    const offeringId = await findOfferingIdForExercise(id);
    if (offeringId === null) return res.status(404).json({ error: "not_found" });

    const { email, type } = req.user!;
    const isAdmin = type >= UserType.ADMIN;
    const isStaff = isAdmin || (await isEnrolledAsProfessorOrAssistant(email, offeringId));

    if (!isStaff && !(await isEnrolled(email, offeringId))) {
      return res.status(403).json({ error: "forbidden" });
    }

    const result = await getExerciseDetail(id, isStaff);
    if (result === null || result === "not_visible") {
      return res.status(404).json({ error: "not_found" });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});
