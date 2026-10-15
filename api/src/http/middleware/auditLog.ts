import type { NextFunction, Response } from "express";
import type { LogRepository } from "../../repositories/log.repository.js";
import type { AuthedRequest } from "./requireAuth.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizeIp(ip: string | undefined): string {
  // The logs table's ip column is varchar(15), sized for IPv4. Strip the
  // IPv4-mapped-IPv6 prefix Express gives for IPv4 clients (::ffff:1.2.3.4)
  // and hard-truncate anything else (a real IPv6 address) rather than let
  // the insert fail — this is best-effort auditing, not the source of truth.
  const stripped = ip?.replace(/^::ffff:/, "") ?? "0.0.0.0";
  return stripped.slice(0, 15);
}

/**
 * Mirrors Log::register(), which the legacy app calls by hand from
 * ~60 controller actions — one audit line per mutation, written at the
 * point of the mutation itself. That approach doesn't survive the move to
 * layered services: a service has no HTTP context, and sprinkling
 * `logs.create(...)` into 60+ service methods would be exactly the kind
 * of ad-hoc coupling this migration is trying to get away from.
 *
 * Instead, this is the one place that knows about both HTTP and
 * auditing: every authenticated mutating request (POST/PUT/PATCH/DELETE)
 * gets one log line after the response is sent, whatever the outcome
 * (a denied action is still audit-relevant — arguably more so than a
 * successful one). The trade-off is message richness: legacy's
 * hand-written prose ("Enrolled in the offering #5") becomes
 * "POST /api/enrollments -> 201". Same who/what/when/result, less
 * narrative — and it covers every mutating route automatically,
 * including ones added after this file was written.
 */
export function createAuditLog(logs: LogRepository) {
  return function auditLog(req: AuthedRequest, res: Response, next: NextFunction) {
    if (!MUTATING_METHODS.has(req.method)) return next();

    res.on("finish", () => {
      logs
        .create({
          userEmail: req.user?.email ?? "SYSTEM",
          ip: normalizeIp(req.ip),
          action: `${req.method} ${req.originalUrl} -> ${res.statusCode}`,
        })
        .catch(() => {}); // audit logging must never be why a request fails
    });

    next();
  };
}
