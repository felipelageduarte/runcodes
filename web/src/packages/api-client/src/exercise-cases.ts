import { apiFetch } from "./http";

/** Metadata only — o backend nunca devolve o texto de input/output no
 * GET (ExerciseCaseService.listForExercise), só flags/limites/hashes. */
export interface ExerciseCaseRecord {
  id: number;
  exerciseId: number;
  outputType: number;
  showInput: boolean | null;
  showExpectedOutput: boolean | null;
  showUserOutput: boolean | null;
  cputime: number;
  maxmemsize: number;
  stacksize: number;
  fileSize: number;
  absError: number | null;
  inputMd5: string | null;
  outputMd5: string | null;
}

export interface ExerciseCaseInput {
  input: string;
  output: string;
  outputType: number;
  showInput: boolean;
  showExpectedOutput: boolean;
  showUserOutput: boolean;
  cputime: number;
  maxmemsize?: number;
  stacksize?: number;
  absError?: number | null;
}

export function listExerciseCases(exerciseId: number): Promise<ExerciseCaseRecord[]> {
  return apiFetch(`/exercises/${exerciseId}/cases`);
}

export function createExerciseCase(exerciseId: number, input: ExerciseCaseInput): Promise<ExerciseCaseRecord> {
  return apiFetch(`/exercises/${exerciseId}/cases`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `input`/`output` omitidos mantêm o conteúdo atual — o GET nunca
 * devolve esse texto pra pré-preencher o form, então editar sem
 * retypar o caso de teste é o fluxo normal (só ajustar flags/limites). */
export function updateExerciseCase(
  id: number,
  input: Partial<ExerciseCaseInput>,
): Promise<ExerciseCaseRecord> {
  return apiFetch(`/exercise-cases/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteExerciseCase(id: number): Promise<void> {
  return apiFetch(`/exercise-cases/${id}`, { method: "DELETE" });
}

/** Cria vários casos de uma vez, mesma config compartilhada repetida em
 * cada item (sem upload de arquivo `.in`/`.out` casado por nome como o
 * legado — texto direto, ver docs/backend/exercise-management.md). */
export function createExerciseCasesBatch(
  exerciseId: number,
  cases: ExerciseCaseInput[],
): Promise<ExerciseCaseRecord[]> {
  return apiFetch(`/exercises/${exerciseId}/cases/batch`, {
    method: "POST",
    body: JSON.stringify({ cases }),
  });
}

export interface CaseVisibilityPatch {
  showInput?: boolean;
  showExpectedOutput?: boolean;
  showUserOutput?: boolean;
}

/** Aplica a mesma flag de visibilidade a todos os casos do exercício. */
export function setExerciseCasesVisibility(
  exerciseId: number,
  patch: CaseVisibilityPatch,
): Promise<{ count: number }> {
  return apiFetch(`/exercises/${exerciseId}/cases/visibility`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function removeAllExerciseCases(exerciseId: number): Promise<{ count: number }> {
  return apiFetch(`/exercises/${exerciseId}/cases`, { method: "DELETE" });
}

/** Zip dos inputs/outputs — staff vê tudo, aluno só o que tem
 * `showInput`/`showExpectedOutput` marcado. */
export function exerciseCasesDownloadUrl(exerciseId: number): string {
  const base = import.meta.env.VITE_API_URL ?? "/api";
  return `${base}/exercises/${exerciseId}/cases/download.zip`;
}

export interface ExerciseCaseFileRecord {
  id: number;
  exerciseCaseId: number;
  path: string;
}

export function listExerciseCaseFiles(exerciseCaseId: number): Promise<ExerciseCaseFileRecord[]> {
  return apiFetch(`/exercise-cases/${exerciseCaseId}/files`);
}

export function uploadExerciseCaseFile(exerciseCaseId: number, file: File): Promise<ExerciseCaseFileRecord> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch(`/exercise-cases/${exerciseCaseId}/files`, {
    method: "POST",
    body: form,
    raw: true,
  });
}

export function exerciseCaseFileDownloadUrl(fileId: number): string {
  const base = import.meta.env.VITE_API_URL ?? "/api";
  return `${base}/exercise-case-files/${fileId}/download`;
}

export function deleteExerciseCaseFile(fileId: number): Promise<void> {
  return apiFetch(`/exercise-case-files/${fileId}`, { method: "DELETE" });
}
