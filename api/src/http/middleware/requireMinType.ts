import type { NextFunction, Response } from "express";
import type { AuthedRequest } from "./requireAuth.js";

/** Gate a route behind req.user.type >= minType. Must run after requireAuth. */
export function requireMinType(minType: number) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "missing_token" });
    if (req.user.type < minType) return res.status(403).json({ error: "forbidden" });
    next();
  };
}
