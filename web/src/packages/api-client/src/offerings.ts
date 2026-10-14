import { apiFetch } from "./http";
import type { CommitRecord } from "./commits";
import type { EnrollmentRecord } from "./enrollments";

export interface StaffMember {
  role: number;
  email: string;
  name: string;
}

export interface OfferingSummary {
  id: number;
  courseId: number;
  year: number;
  term: number;
  classroom: string | null;
  endDate: string;
  enrollmentCode: string | null;
  maxStudents: number | null;
  maxExercises: number | null;
  course: { id: number; code: string; title: string; universityId: number } | null;
  university: { id: number; name: string; abbreviation: string } | null;
  professors: StaffMember[];
  assistants: StaffMember[];
}

export interface ExerciseListItem {
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
  /** null quando o aluno nunca submeteu nada neste exercício. */
  myLatestCommit: CommitRecord | null;
}

export interface OfferingDetail extends OfferingSummary {
  exercises: ExerciseListItem[];
}

export function listMyOfferings(): Promise<{ open: OfferingSummary[]; closed: OfferingSummary[] }> {
  return apiFetch("/offerings/mine");
}

export function getOffering(id: number): Promise<OfferingDetail> {
  return apiFetch(`/offerings/${id}`);
}

/** Catálogo geral de turmas (não só as do usuário) — aberto a qualquer
 * autenticado, mas só faz sentido pra quem pode agir sobre turmas que
 * não é staff (ex: admin escolhendo destino de compartilhamento). */
export function listOfferings(
  params: { closed?: boolean; q?: string; page?: number; pageSize?: number } = {},
): Promise<{
  total: number;
  page: number;
  pageSize: number;
  offerings: OfferingSummary[];
}> {
  const qs = new URLSearchParams();
  if (params.closed) qs.set("closed", "true");
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 100));
  return apiFetch(`/offerings?${qs.toString()}`);
}

export interface NewOfferingInput {
  courseId: number;
  classroom: string | null;
  endDate: string;
}

/** Professor+ — abre turma nova, auto-matricula o criador como professor
 * e manda o código de matrícula por email. */
export function createOffering(input: NewOfferingInput): Promise<OfferingSummary> {
  return apiFetch("/offerings", { method: "POST", body: JSON.stringify(input) });
}

export interface OfferingUpdateInput {
  classroom?: string | null;
  endDate?: string;
}

/** Staff da turma ou admin — só `classroom`/`endDate` são editáveis. */
export function updateOffering(id: number, input: OfferingUpdateInput): Promise<OfferingSummary> {
  return apiFetch(`/offerings/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

/** `role` segue EnrollmentRole: 0 aluno, 1 assistente, 2 professor —
 * exige staff(assistente+) ou admin da turma. */
export function setMemberRole(offeringId: number, email: string, role: number): Promise<EnrollmentRecord> {
  return apiFetch(`/offerings/${offeringId}/members/${encodeURIComponent(email)}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

/** Admin-only no backend — igual ao legado, professor não bane sem
 * supervisão (ver offering-membership.service.ts). */
export function banMember(offeringId: number, email: string): Promise<EnrollmentRecord> {
  return apiFetch(`/offerings/${offeringId}/members/${encodeURIComponent(email)}/ban`, {
    method: "POST",
  });
}

/** Staff da turma ou admin — matricula alguém direto, sem código. */
export function enrollMember(offeringId: number, email: string): Promise<EnrollmentRecord> {
  return apiFetch(`/offerings/${offeringId}/members/${encodeURIComponent(email)}`, {
    method: "POST",
  });
}

/** Staff da turma ou admin — remoção definitiva (hard delete), diferente
 * de `banMember` (soft, admin-only). */
export function unenrollMember(offeringId: number, email: string): Promise<void> {
  return apiFetch(`/offerings/${offeringId}/members/${encodeURIComponent(email)}`, {
    method: "DELETE",
  });
}

/** Staff da turma ou admin — email avulso pra todo mundo matriculado. */
export function emailOffering(
  offeringId: number,
  input: { subject: string; message: string },
): Promise<{ count: number }> {
  return apiFetch(`/offerings/${offeringId}/email`, { method: "POST", body: JSON.stringify(input) });
}

export interface StudentGrade {
  studentEmail: string;
  score: string | null;
  status: number | null;
  commitId: number | null;
}

export interface ExerciseGrades {
  exerciseId: number;
  title: string;
  deadline: string;
  grades: StudentGrade[];
}

export interface GradesView {
  students: { email: string; name: string; identifier: string | null }[];
  exercises: ExerciseGrades[];
}

export function getGrades(offeringId: number): Promise<GradesView> {
  return apiFetch(`/offerings/${offeringId}/grades`);
}

export function gradesExportCsvUrl(offeringId: number): string {
  const base = import.meta.env.VITE_API_URL ?? "/api";
  return `${base}/offerings/${offeringId}/grades/export.csv`;
}

export interface OfferingExerciseStats {
  exerciseLabels: string[];
  classAverage: (number | null)[];
  participant?: { name: string; scores: number[] };
}

export function getOfferingStats(offeringId: number, participantEmail?: string): Promise<OfferingExerciseStats> {
  const qs = participantEmail ? `?participantEmail=${encodeURIComponent(participantEmail)}` : "";
  return apiFetch(`/offerings/${offeringId}/stats${qs}`);
}

export interface OfferingInfographic {
  studentCount: number;
  gradesAbove5Percent: number;
  gradesAverage: number;
}

export function getOfferingInfographic(offeringId: number): Promise<OfferingInfographic> {
  return apiFetch(`/offerings/${offeringId}/infographic`);
}
