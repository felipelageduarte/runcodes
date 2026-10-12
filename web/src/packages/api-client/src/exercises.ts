import { apiFetch } from "./http";

export interface AllowedFile {
  id: number;
  name: string;
  extension: string;
  compilable: boolean | null;
  compileCommand: string | null;
  runCommand: string | null;
  available: boolean | null;
}

export interface ExerciseDetail {
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
  isOpen: boolean;
  casesCount: number;
  allowedFiles: AllowedFile[];
}

export function getExercise(id: number): Promise<ExerciseDetail> {
  return apiFetch(`/exercises/${id}`);
}
