import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../../domain/errors.js";

// Single place that maps errors to HTTP responses. Services/repositories
// throw typed domain errors or let Zod throw on bad input; routes never
// need an instanceof chain — they just call next(err) and this handles it.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.code });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "invalid_body", details: err.issues });
  }
  console.error(err);
  res.status(500).json({ error: "internal_error" });
}
