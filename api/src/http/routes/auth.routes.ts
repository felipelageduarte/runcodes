import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { AuthService } from "../../services/auth.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { SESSION_COOKIE_NAME } from "../middleware/requireAuth.js";

const loginSchema = z.object({
  // Not .email(): legacy rows (e.g. "admin@admin") predate strict
  // validation and still need to log in. Enforced on signup instead.
  email: z.string().min(1),
  password: z.string().min(1),
});

const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function createAuthRouter(authService: AuthService, requireAuth: RequestHandler) {
  const router = Router();

  router.post("/login", async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await authService.login(email, password);
      // Cookie is what runcodes-web relies on (JS never touches the
      // token — see docs/frontend/security.md). The token is still
      // returned in the body too, for API clients/scripts/tests that
      // authenticate via the Authorization header instead.
      res.cookie(SESSION_COOKIE_NAME, result.token, {
        ...cookieOptions(),
        maxAge: SESSION_COOKIE_MAX_AGE_MS,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, cookieOptions());
    res.status(204).send();
  });

  router.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const me = await authService.me(req.user!.email);
      if (!me) return res.status(401).json({ error: "invalid_token" });
      res.json(me);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
