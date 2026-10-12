import { apiFetch } from "./http";

export interface CommitRecord {
  id: number;
  userEmail: string;
  exerciseId: number;
  commitTime: string;
  status: number;
  hash: string | null;
  corrects: number | null;
  score: string | null;
  compiled: boolean | null;
  compiledMessage: string | null;
  awsKey: string | null;
  ip: string | null;
}

export interface CommitCaseResult {
  id: number;
  exerciseCaseId: number;
  cputime: string;
  memused: number;
  outputType: number;
  status: number;
  statusMessage: string | null;
  error: string | null;
  output: string | null;
  expectedInput: string | null;
  expectedOutput: string | null;
}

export function submitCommit(exerciseId: number, file: File): Promise<CommitRecord> {
  const formData = new FormData();
  formData.append("files", file);
  return apiFetch(`/exercises/${exerciseId}/commits`, {
    method: "POST",
    body: formData,
    raw: true,
  });
}

export function listCommitsForExercise(exerciseId: number): Promise<CommitRecord[]> {
  return apiFetch(`/exercises/${exerciseId}/commits`);
}

export function getCommit(id: number): Promise<CommitRecord> {
  return apiFetch(`/commits/${id}`);
}

export function getCommitCases(id: number): Promise<CommitCaseResult[]> {
  return apiFetch(`/commits/${id}/cases`);
}
