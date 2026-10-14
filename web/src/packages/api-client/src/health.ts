import { apiFetch } from "./http";

export interface HealthStatus {
  status: string;
  /** Server wall-clock time (ISO 8601) — drives the live server clock in
   * the topbar, same contract as the legacy "Server's Clock". */
  now: string;
}

export function getHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health");
}
