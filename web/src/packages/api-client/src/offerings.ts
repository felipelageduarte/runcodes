import { apiFetch } from "./http";
import type { CommitRecord } from "./commits";

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
