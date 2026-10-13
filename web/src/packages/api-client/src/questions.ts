import { apiFetch } from "./http";

export interface QuestionRecord {
  id: number;
  title: string | null;
  text: string | null;
  tags: string | null;
}

export interface QuestionInput {
  title: string;
  text: string;
  tags: string | null;
}

/** Leitura é pública (nem precisa estar logado) — mirrors o legado. */
export function listQuestions(
  page = 1,
  pageSize = 20,
): Promise<{ total: number; page: number; pageSize: number; questions: QuestionRecord[] }> {
  return apiFetch(`/questions?page=${page}&pageSize=${pageSize}`);
}

export function getQuestion(id: number): Promise<QuestionRecord> {
  return apiFetch(`/questions/${id}`);
}

export function createQuestion(input: QuestionInput): Promise<QuestionRecord> {
  return apiFetch("/questions", { method: "POST", body: JSON.stringify(input) });
}

export function updateQuestion(id: number, input: Partial<QuestionInput>): Promise<QuestionRecord> {
  return apiFetch(`/questions/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteQuestion(id: number): Promise<void> {
  return apiFetch(`/questions/${id}`, { method: "DELETE" });
}
