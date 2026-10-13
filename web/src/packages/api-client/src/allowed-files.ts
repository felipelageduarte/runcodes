import { apiFetch } from "./http";
import type { AllowedFile } from "./exercises";

/** Popula o picker de "tipos de arquivo aceitos" na criação de exercício
 * — aberto a qualquer autenticado (GET /allowed-files). */
export function listAllowedFiles(): Promise<AllowedFile[]> {
  return apiFetch("/allowed-files?includeUnavailable=false");
}
