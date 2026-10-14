import { apiFetch } from "./http";

export interface StatusCount {
  status: number;
  count: number;
}

export interface PipelineStats {
  /** Commits currently queued/compiling/running — no time window. */
  inFlight: StatusCount[];
  /** All outcomes in the last hour — throughput/error-rate signal. */
  recentHour: StatusCount[];
}

export function getPipelineStats(): Promise<PipelineStats> {
  return apiFetch("/admin/pipeline/stats");
}

export interface ActiveCommit {
  id: number;
  userEmail: string;
  exerciseId: number;
  exerciseTitle: string;
  status: number;
  commitTime: string;
  compilationStarted: string | null;
}

export function listActiveCommits(limit = 50): Promise<ActiveCommit[]> {
  return apiFetch(`/admin/pipeline/active?limit=${limit}`);
}
