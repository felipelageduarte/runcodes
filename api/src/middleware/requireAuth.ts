import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../lib/env.js";

export interface AuthedRequest extends Request {
  user?: { email: string; type: number };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: "missing_token" });

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; type: number };
    req.user = { email: payload.sub, type: payload.type };
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}
