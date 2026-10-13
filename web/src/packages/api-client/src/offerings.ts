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
