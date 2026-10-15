import { apiFetch } from "./http";

export interface LogRecord {
  id: number;
  userEmail: string;
  datetime: string;
  ip: string;
  action: string;
}

export interface LogListFilter {
  userEmail?: string;
  ip?: string;
  q?: string;
  status?: number;
  page?: number;
  pageSize?: number;
}

function filterQs(filter: Pick<LogListFilter, "userEmail" | "ip" | "q" | "status">): URLSearchParams {
  const qs = new URLSearchParams();
  if (filter.userEmail) qs.set("userEmail", filter.userEmail);
  if (filter.ip) qs.set("ip", filter.ip);
  if (filter.q) qs.set("q", filter.q);
  if (filter.status !== undefined) qs.set("status", String(filter.status));
  return qs;
}

export function listLogs(
  filter: LogListFilter = {},
): Promise<{ total: number; page: number; pageSize: number; logs: LogRecord[] }> {
  const qs = filterQs(filter);
  qs.set("page", String(filter.page ?? 1));
  qs.set("pageSize", String(filter.pageSize ?? 50));
  return apiFetch(`/admin/logs?${qs.toString()}`);
}

export interface LogStats {
  total: number;
  errors: number;
  topAction: string | null;
  topActionCount: number;
}

export function getLogStats(filter: Pick<LogListFilter, "userEmail" | "ip" | "q" | "status"> = {}): Promise<LogStats> {
  return apiFetch(`/admin/logs/stats?${filterQs(filter).toString()}`);
}
