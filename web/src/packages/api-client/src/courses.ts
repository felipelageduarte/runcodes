import { apiFetch } from "./http";

export interface CourseSummary {
  id: number;
  code: string;
  title: string;
  universityId: number;
}

/** Admin-only no backend — catálogo completo de disciplinas. */
export function listCourses(params: { page?: number; pageSize?: number } = {}): Promise<{
  total: number;
  page: number;
  pageSize: number;
  courses: CourseSummary[];
}> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 1));
  qs.set("pageSize", String(params.pageSize ?? 100));
  // Backend caps pageSize at 100 (see courses.routes.ts listQuerySchema).
  return apiFetch(`/courses?${qs.toString()}`);
}

/** Professor+ buscando um curso da própria universidade pra abrir turma nova. */
export function searchMyCourses(q?: string): Promise<CourseSummary[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch(`/courses/search/mine${qs}`);
}

export interface CourseInput {
  code: string;
  title: string;
  universityId: number;
}

/** Admin-only no backend. */
export function createCourse(input: CourseInput): Promise<CourseSummary> {
  return apiFetch("/courses", { method: "POST", body: JSON.stringify(input) });
}
