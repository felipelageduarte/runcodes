import { apiFetch } from "./http";
import type { AllowedFile } from "./exercises";

/** Popula o picker de "tipos de arquivo aceitos" na criação de exercício
 * — aberto a qualquer autenticado (GET /allowed-files). */
export function listAllowedFiles(): Promise<AllowedFile[]> {
  return apiFetch("/allowed-files?includeUnavailable=false");
}

/** Lista completa (incluindo desabilitados) — uso admin. */
export function listAllAllowedFiles(): Promise<AllowedFile[]> {
  return apiFetch("/allowed-files?includeUnavailable=true");
}

export interface AllowedFileInput {
  name: string;
  extension: string;
  compilable: boolean;
  compileCommand: string | null;
  runCommand: string | null;
}

export function createAllowedFile(input: AllowedFileInput): Promise<AllowedFile> {
  return apiFetch("/allowed-files", { method: "POST", body: JSON.stringify(input) });
}

export function updateAllowedFile(
  id: number,
  input: Partial<AllowedFileInput> & { available?: boolean },
): Promise<AllowedFile> {
  return apiFetch(`/allowed-files/${id}`, { method: "PUT", body: JSON.stringify(input) });
}
