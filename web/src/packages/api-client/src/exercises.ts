import { apiFetch } from "./http";

export interface AllowedFile {
  id: number;
  name: string;
  extension: string;
  compilable: boolean | null;
  compileCommand: string | null;
  runCommand: string | null;
  available: boolean | null;
}

export interface ExerciseDetail {
  id: number;
  offeringId: number;
  title: string;
  description: string | null;
  deadline: string;
  type: number;
  openDate: string | null;
  showBeforeOpening: boolean | null;
  ghost: boolean | null;
  realId: number | null;
  markdown: boolean | null;
  isOpen: boolean;
  casesCount: number;
  allowedFiles: AllowedFile[];
}

export function getExercise(id: number): Promise<ExerciseDetail> {
  return apiFetch(`/exercises/${id}`);
}

export interface ExerciseInput {
  title: string;
  description: string | null;
  deadline: string;
  openDate: string | null;
  type: number;
  showBeforeOpening: boolean;
  markdown: boolean;
  allowedFileIds: number[];
}

export function createExercise(offeringId: number, input: ExerciseInput): Promise<ExerciseDetail> {
  return apiFetch(`/offerings/${offeringId}/exercises`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateExercise(id: number, input: Partial<ExerciseInput>): Promise<ExerciseDetail> {
  return apiFetch(`/exercises/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteExercise(id: number): Promise<void> {
  return apiFetch(`/exercises/${id}`, { method: "DELETE" });
}

/** Clona o exercício como "ghost" na turma destino — mirrors
 * Exercise::createGhostExercise() do legado. Exige ser staff/admin da
 * turma DESTINO, não da original. */
export function shareExercise(id: number, targetOfferingId: number): Promise<ExerciseDetail> {
  return apiFetch(`/exercises/${id}/share`, {
    method: "POST",
    body: JSON.stringify({ targetOfferingId }),
  });
}

export interface ExerciseCaseStats {
  caseLabels: string[];
  correctPercentage: number[];
}

export function getExerciseCaseStats(exerciseId: number): Promise<ExerciseCaseStats> {
  return apiFetch(`/exercises/${exerciseId}/stats`);
}

export interface ParticipantCommitSummary {
  id: number;
  commitTime: string;
  status: number;
  corrects: number | null;
  score: string | null;
}

export function getParticipantCommits(
  exerciseId: number,
  userEmail: string,
): Promise<ParticipantCommitSummary[]> {
  return apiFetch(`/exercises/${exerciseId}/participants/${encodeURIComponent(userEmail)}/commits`);
}

export function exportSubmissionsZipUrl(exerciseId: number): string {
  const base = import.meta.env.VITE_API_URL ?? "/api";
  return `${base}/exercises/${exerciseId}/export-submissions.zip`;
}
