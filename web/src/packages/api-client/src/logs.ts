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
  page?: number;
  pageSize?: number;
}

export function listLogs(
  filter: LogListFilter = {},
): Promise<{ total: number; page: number; pageSize: number; logs: LogRecord[] }> {
  const qs = new URLSearchParams();
  if (filter.userEmail) qs.set("userEmail", filter.userEmail);
  if (filter.ip) qs.set("ip", filter.ip);
  qs.set("page", String(filter.page ?? 1));
  qs.set("pageSize", String(filter.pageSize ?? 50));
  return apiFetch(`/admin/logs?${qs.toString()}`);
}
