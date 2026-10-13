import { apiFetch } from "./http";

export interface UniversitySummary {
  id: number;
  name: string;
  abbreviation: string;
}

/** Aberto a qualquer autenticado — popula o filtro de instituição de
 * origem no marketplace. */
export function listUniversities(): Promise<UniversitySummary[]> {
  return apiFetch("/universities");
}
