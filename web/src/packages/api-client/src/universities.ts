import { apiFetch } from "./http";

export interface UniversitySummary {
  id: number;
  name: string;
  abbreviation: string;
  studentIdentifierText: string | null;
  type: number | null;
  state: string | null;
}

/** Aberto a qualquer autenticado — popula o filtro de instituição de
 * origem no marketplace e a lista no admin. */
export function listUniversities(): Promise<UniversitySummary[]> {
  return apiFetch("/universities");
}

export interface UniversityInput {
  abbreviation: string;
  name: string;
  studentIdentifierText: string | null;
  type: number | null;
  state: string | null;
}

export function createUniversity(input: UniversityInput): Promise<UniversitySummary> {
  return apiFetch("/universities", { method: "POST", body: JSON.stringify(input) });
}

export function updateUniversity(id: number, input: Partial<UniversityInput>): Promise<UniversitySummary> {
  return apiFetch(`/universities/${id}`, { method: "PUT", body: JSON.stringify(input) });
}
