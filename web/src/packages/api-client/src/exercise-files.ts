import { apiFetch } from "./http";

export interface AttachmentRecord {
  id: number;
  exerciseId: number;
  path: string;
}

export function listExerciseFiles(exerciseId: number): Promise<AttachmentRecord[]> {
  return apiFetch(`/exercises/${exerciseId}/files`);
}

/** Mesma origem (proxy /api em dev, mesmo domínio em produção) — o
 * browser manda o cookie de sessão automaticamente num <a href> normal,
 * não precisa de fetch+blob. */
export function exerciseFileDownloadUrl(attachmentId: number): string {
  const base = import.meta.env.VITE_API_URL ?? "/api";
  return `${base}/exercise-files/${attachmentId}/download`;
}

/** Staff/admin only no backend (exercise-attachment.service.ts). */
export function uploadExerciseFile(exerciseId: number, file: File): Promise<AttachmentRecord> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch(`/exercises/${exerciseId}/files`, { method: "POST", body: form, raw: true });
}

export function deleteExerciseFile(attachmentId: number): Promise<void> {
  return apiFetch(`/exercise-files/${attachmentId}`, { method: "DELETE" });
}
