import { apiFetch } from "./http";

/** Uma linha da trilha `audit_log` (runcodes-api, migration 007). O corpo
 * já chega redigido e truncado pelo servidor; a UI só exibe. */
export interface AuditRecord {
  id: number;
  at: string;
  actorEmail: string | null;
  actorType: number | null;
  viewAsType: number | null;
  method: string;
  path: string;
  route: string;
  status: number;
  durationMs: number | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  requestBody: unknown;
  targetType: string | null;
  targetId: string | null;
}

export interface AuditFeedFilter {
  actor?: string;
  method?: string;
  status?: number;
  route?: string;
  /** ISO 8601. */
  since?: string;
  until?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface AuditFeedPage {
  total: number;
  limit: number;
  offset: number;
  items: AuditRecord[];
}

export interface AuditStats {
  days: number;
  total: number;
  errors: number;
  avgDurationMs: number;
  actors: number;
  topActions: { action: string; count: number; avgMs: number }[];
  topActors: { actorEmail: string; count: number }[];
  daily: { day: string; count: number; errors: number }[];
}

export const AUDIT_FEED_PAGE_SIZE = 50;

export function listAuditFeed(filter: AuditFeedFilter = {}): Promise<AuditFeedPage> {
  const qs = new URLSearchParams();
  if (filter.actor) qs.set("actor", filter.actor);
  if (filter.method) qs.set("method", filter.method);
  if (filter.status !== undefined) qs.set("status", String(filter.status));
  if (filter.route) qs.set("route", filter.route);
  if (filter.since) qs.set("since", filter.since);
  if (filter.until) qs.set("until", filter.until);
  if (filter.q) qs.set("q", filter.q);
  qs.set("limit", String(filter.limit ?? AUDIT_FEED_PAGE_SIZE));
  qs.set("offset", String(filter.offset ?? 0));
  return apiFetch(`/admin/audit/feed?${qs.toString()}`);
}

export function getAuditStats(days = 7): Promise<AuditStats> {
  return apiFetch(`/admin/audit/stats?days=${days}`);
}
