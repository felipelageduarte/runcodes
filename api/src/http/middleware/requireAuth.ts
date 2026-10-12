import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Requester } from "../../services/offering.service.js";

export interface AuthedRequest extends Request {
  user?: Requester;
}

/** Factory, not a singleton import — the JWT secret flows in from the
 * composition root instead of each file reading process.env itself. */
export function createRequireAuth(jwtSecret: string) {
  return function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) return res.status(401).json({ error: "missing_token" });

    try {
      const payload = jwt.verify(token, jwtSecret) as { sub: string; type: number };
      req.user = { email: payload.sub, type: payload.type };
      next();
    } catch {
      res.status(401).json({ error: "invalid_token" });
    }
  };
}
