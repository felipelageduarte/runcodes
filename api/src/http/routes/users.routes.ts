import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { UserService } from "../../services/user.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

const signupSchema = z.object({
  email: z.string().email(), // strict here: this is new-account creation, not a legacy-data lookup
  name: z.string().min(1),
  password: z.string().min(8),
  universityId: z.number().int().optional(),
});

const confirmSchema = z.object({
  email: z.string().min(1),
  token: z.string().min(1),
});

const emailOnlySchema = z.object({ email: z.string().min(1) });

const resetPasswordSchema = z.object({
  email: z.string().min(1),
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

const profilePatchSchema = z.object({
  name: z.string().min(1).optional(),
  universityId: z.number().int().nullable().optional(),
  identifier: z.string().nullable().optional(),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export function createUsersRouter(userService: UserService, requireAuth: RequestHandler) {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const input = signupSchema.parse(req.body);
      await userService.signup({
        email: input.email,
        name: input.name,
        password: input.password,
        universityId: input.universityId ?? null,
      });
      res.status(201).json({ email: input.email });
    } catch (err) {
      next(err);
    }
  });

  router.post("/confirm", async (req, res, next) => {
    try {
      const { email, token } = confirmSchema.parse(req.body);
      await userService.confirm(email, token);
      res.json({ confirmed: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/resend-confirmation", async (req, res, next) => {
    try {
      const { email } = emailOnlySchema.parse(req.body);
      await userService.resendConfirmation(email);
      res.json({ sent: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/request-password-reset", async (req, res, next) => {
    try {
      const { email } = emailOnlySchema.parse(req.body);
      await userService.requestPasswordReset(email);
      res.json({ sent: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/reset-password", async (req, res, next) => {
    try {
      const { email, token, newPassword } = resetPasswordSchema.parse(req.body);
      await userService.resetPassword(email, token, newPassword);
      res.json({ reset: true });
    } catch (err) {
      next(err);
    }
  });

  // Self-service profile — mirrors UsersController::profile(). `/me`,
  // not `/:email`, so there's never a path param to misuse against
  // someone else's account: the target is always the session's own.
  router.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      res.json(await userService.getProfile(req.user!.email));
    } catch (err) {
      next(err);
    }
  });

  router.put("/me", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const input = profilePatchSchema.parse(req.body);
      res.json(await userService.updateProfile(req.user!.email, input));
    } catch (err) {
      next(err);
    }
  });

  router.put("/me/password", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { oldPassword, newPassword } = changePasswordSchema.parse(req.body);
      await userService.changePassword(req.user!.email, oldPassword, newPassword);
      res.json({ changed: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
