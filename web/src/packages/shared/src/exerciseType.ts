// Mirrors Exercise::getCompilableIndex()/getNotCompilableIndex() via
// runcodes-api's src/lib/constants.ts.
export const COMPILABLE_EXERCISE_TYPES = [0, 2];
export const NOT_COMPILABLE_EXERCISE_TYPE = 1;

export function isCompilableExerciseType(type: number): boolean {
  return COMPILABLE_EXERCISE_TYPES.includes(type);
}

// Mirrors CommitService.submit()'s size limits — client-side check is
// only for immediate feedback, the server still enforces this for real
// (see docs/frontend/security.md).
export function maxUploadSizeFor(type: number): number {
  return isCompilableExerciseType(type) ? 1_000_000 : 5_000_000;
}

/** Strips the legacy "*." prefix allowed_files.extension carries
 * (e.g. "*.py" -> "py"). */
export function normalizeExtension(extension: string): string {
  return extension.replace(/^\*\./, "").toLowerCase();
}

export function extensionOfFilename(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.slice(1).join(".").toLowerCase() : "";
}
