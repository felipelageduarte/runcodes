import { apiFetch } from "./http";

export type PlagiarismProviderName = "dolos" | "jplag";
export type PlagiarismRunStatus = "queued" | "running" | "completed" | "failed";

export interface PlagiarismPairResult {
  studentA: string;
  studentB: string;
  similarity: number;
}

export interface PlagiarismRunRecord {
  id: number;
  exerciseId: number;
  provider: PlagiarismProviderName;
  status: PlagiarismRunStatus;
  requestedBy: string;
  result: PlagiarismPairResult[] | null;
  error: string | null;
  createdAt: string;
}

/** Enfileira, não espera o resultado (pode levar minutos) — poller via
 * getPlagiarismRun até status === "completed" | "failed". */
export function requestPlagiarismRun(
  exerciseId: number,
  provider: PlagiarismProviderName,
): Promise<PlagiarismRunRecord> {
  return apiFetch(`/exercises/${exerciseId}/plagiarism-runs`, {
    method: "POST",
    body: JSON.stringify({ provider }),
  });
}

export function listPlagiarismRuns(exerciseId: number): Promise<PlagiarismRunRecord[]> {
  return apiFetch(`/exercises/${exerciseId}/plagiarism-runs`);
}

export function getPlagiarismRun(id: number): Promise<PlagiarismRunRecord> {
  return apiFetch(`/plagiarism-runs/${id}`);
}
