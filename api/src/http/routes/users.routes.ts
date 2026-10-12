import { Router } from "express";
import { z } from "zod";
import type { UserService } from "../../services/user.service.js";

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

export function createUsersRouter(userService: UserService) {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const input = signupSchema.parse(req.body);
      const { confirmationToken } = await userService.signup({
        email: input.email,
        name: input.name,
        password: input.password,
        universityId: input.universityId ?? null,
      });
      // TODO(roadmap: emails transacionais): deliver confirmationToken by
      // email instead of returning it — no email-sending module exists
      // yet, so this is the only way to complete the flow for now.
      res.status(201).json({ email: input.email, confirmationToken });
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

  return router;
}
