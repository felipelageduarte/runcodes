import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/requireAuth.js";
import { upload } from "../../middleware/upload.js";
import { UserType } from "../../lib/constants.js";
import { isEnrolled, isEnrolledAsProfessorOrAssistant } from "../enrollments/enrollment.service.js";
import { findOfferingIdForExercise } from "../exercises/exercises.service.js";
import {
  submitCommit,
  listCommitsForUser,
  getCommit,
  ExerciseClosedError,
  FileTypeNotAllowedError,
  FileTooLargeError,
} from "./commits.service.js";

export const exerciseCommitsRouter = Router({ mergeParams: true });
export const commitsRouter = Router();

async function canAccessExercise(req: AuthedRequest, offeringId: number) {
  const { email, type } = req.user!;
  const isAdmin = type >= UserType.ADMIN;
  const isStaff = isAdmin || (await isEnrolledAsProfessorOrAssistant(email, offeringId));
  const allowed = isStaff || (await isEnrolled(email, offeringId));
  return { isStaff, allowed };
}

// POST /api/exercises/:exerciseId/commits — mirrors ExercisesController::commit().
exerciseCommitsRouter.post(
  "/",
  requireAuth,
  upload.single("files"),
  async (req: AuthedRequest, res, next) => {
    try {
      const exerciseId = Number(req.params.exerciseId);
      if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });
      if (!req.file) return res.status(400).json({ error: "missing_file" });

      const offeringId = await findOfferingIdForExercise(exerciseId);
      if (offeringId === null) return res.status(404).json({ error: "not_found" });

      const { isStaff, allowed } = await canAccessExercise(req, offeringId);
      if (!allowed) return res.status(403).json({ error: "forbidden" });

      const commit = await submitCommit(
        {
          exerciseId,
          userEmail: req.user!.email,
          ip: req.ip ?? null,
          file: { originalname: req.file.originalname, buffer: req.file.buffer },
        },
        isStaff,
      );
      if (!commit) return res.status(404).json({ error: "not_found" });
      res.status(201).json(commit);
    } catch (err) {
      if (err instanceof ExerciseClosedError) {
        return res.status(422).json({ error: "exercise_closed" });
      }
      if (err instanceof FileTypeNotAllowedError) {
        return res.status(422).json({ error: "file_type_not_allowed" });
      }
      if (err instanceof FileTooLargeError) {
        return res.status(422).json({ error: "file_too_large" });
      }
      next(err);
    }
  },
);

// GET /api/exercises/:exerciseId/commits — the caller's own submission history.
exerciseCommitsRouter.get("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const exerciseId = Number(req.params.exerciseId);
    if (!Number.isInteger(exerciseId)) return res.status(400).json({ error: "invalid_id" });

    const offeringId = await findOfferingIdForExercise(exerciseId);
    if (offeringId === null) return res.status(404).json({ error: "not_found" });

    const { allowed } = await canAccessExercise(req, offeringId);
    if (!allowed) return res.status(403).json({ error: "forbidden" });

    res.json(await listCommitsForUser(exerciseId, req.user!.email));
  } catch (err) {
    next(err);
  }
});

// GET /api/commits/:id — poll a single submission's status/result.
commitsRouter.get("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });

    const commit = await getCommit(id);
    if (!commit) return res.status(404).json({ error: "not_found" });

    const { email, type } = req.user!;
    const isAdmin = type >= UserType.ADMIN;
    const isOwner = commit.user_email === email;
    if (!isAdmin && !isOwner) {
      const offeringId = await findOfferingIdForExercise(commit.exercise_id);
      const isStaff =
        offeringId !== null && (await isEnrolledAsProfessorOrAssistant(email, offeringId));
      if (!isStaff) return res.status(403).json({ error: "forbidden" });
    }

    res.json(commit);
  } catch (err) {
    next(err);
  }
});
