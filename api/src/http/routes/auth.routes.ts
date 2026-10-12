import { Router } from "express";
import { z } from "zod";
import type { AuthService } from "../../services/auth.service.js";

const loginSchema = z.object({
  // Not .email(): legacy rows (e.g. "admin@admin") predate strict
  // validation and still need to log in. Enforced on signup instead.
  email: z.string().min(1),
  password: z.string().min(1),
});

export function createAuthRouter(authService: AuthService) {
  const router = Router();

  router.post("/login", async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      res.json(await authService.login(email, password));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
