import { apiFetch } from "./http";

export type DifficultyBucket = "easy" | "medium" | "hard";

export interface MarketplaceStats {
  exerciseId: number;
  adoptionCount: number;
  totalSubmitters: number;
  avgAttemptsToSuccess: number;
  avgScore: number;
  passRate: number;
  difficultyBucket: DifficultyBucket | null;
}

export interface PublicExerciseSummary {
  exerciseId: number;
  title: string;
  description: string | null;
  markdown: boolean;
  level: number | null;
  keywords: string | null;
  createdAt: string;
  languages: string[];
  originUniversity: { id: number; name: string; abbreviation: string } | null;
  stats: MarketplaceStats;
}

export type MarketplaceSortBy = "name" | "recent" | "difficulty" | "popularity";

export interface MarketplaceSearchParams {
  search?: string;
  language?: string;
  universityId?: number;
  sortBy?: MarketplaceSortBy;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function searchMarketplace(
  params: MarketplaceSearchParams = {},
): Promise<{ total: number; entries: PublicExerciseSummary[] }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.language) qs.set("language", params.language);
  if (params.universityId !== undefined) qs.set("universityId", String(params.universityId));
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortDir) qs.set("sortDir", params.sortDir);
  qs.set("page", String(params.page ?? 1));
  qs.set("pageSize", String(params.pageSize ?? 20));
  return apiFetch(`/marketplace/exercises?${qs.toString()}`);
}

export function getMarketplaceExercise(exerciseId: number): Promise<PublicExerciseSummary> {
  return apiFetch(`/marketplace/exercises/${exerciseId}`);
}

export interface PublishExerciseInput {
  level: number;
  obs: string | null;
  keywords: string | null;
}

export interface PublicExerciseRecord {
  id: number;
  exerciseId: number;
  level: number | null;
  obs: string | null;
  keywords: string | null;
  createdAt: string;
}

/** Professor+ global (não precisa ser staff da turma do exercício —
 * mirrors o legado, ver public-exercise.service.ts). */
export function publishExercise(exerciseId: number, input: PublishExerciseInput): Promise<PublicExerciseRecord> {
  return apiFetch(`/public-exercises/${exerciseId}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
