import { apiFetch, apiBase } from "./http";

/** Arquivos usados na compilação (headers, makefiles de apoio) — mesma
 * forma de exercise-files, router genérico montado em outro path
 * (exercise-attachment.routes.ts, instanciado duas vezes). */
export interface CompilationFileRecord {
  id: number;
  exerciseId: number;
  path: string;
}

export function listCompilationFiles(exerciseId: number): Promise<CompilationFileRecord[]> {
  return apiFetch(`/exercises/${exerciseId}/compilation-files`);
}

export function uploadCompilationFile(exerciseId: number, file: File): Promise<CompilationFileRecord> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch(`/exercises/${exerciseId}/compilation-files`, { method: "POST", body: form, raw: true });
}

export function compilationFileDownloadUrl(fileId: number): string {
  return `${apiBase()}/compilation-files/${fileId}/download`;
}

export function deleteCompilationFile(fileId: number): Promise<void> {
  return apiFetch(`/compilation-files/${fileId}`, { method: "DELETE" });
}
