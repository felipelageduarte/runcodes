import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Requester } from "../../services/offering.service.js";

export const SESSION_COOKIE_NAME = "token";

export interface AuthedRequest extends Request {
  user?: Requester;
}

/** Factory, not a singleton import — the JWT secret flows in from the
 * composition root instead of each file reading process.env itself.
 *
 * Accepts the token from either the httpOnly session cookie (set by
 * POST /api/auth/login — what runcodes-web uses) or the Authorization
 * header (what API clients/scripts/the integration test suite use) —
 * cookie takes precedence when both are present. */
export function createRequireAuth(jwtSecret: string) {
  return function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    const headerToken = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const token = req.cookies?.[SESSION_COOKIE_NAME] ?? headerToken;
    if (!token) return res.status(401).json({ error: "missing_token" });

    try {
      const payload = jwt.verify(token, jwtSecret) as { sub: string; type: number; realType?: number };
      req.user = { email: payload.sub, type: payload.type, realType: payload.realType };
      next();
    } catch {
      res.status(401).json({ error: "invalid_token" });
    }
  };
}
