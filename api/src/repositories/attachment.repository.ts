export interface AttachmentRecord {
  id: number;
  exerciseId: number;
  path: string;
}

/** Metadata rows for an exercise attachment (exercise_files or
 * compilation_files) — the file bytes live in S3 via
 * AttachmentStorageRepository, this is just "what files exist for this
 * exercise". Same shape for both tables, two concrete implementations
 * since Prisma models them as distinct tables. */
export interface AttachmentRepository {
  listForExercise(exerciseId: number): Promise<AttachmentRecord[]>;
  findById(id: number): Promise<AttachmentRecord | null>;
  create(exerciseId: number, path: string): Promise<AttachmentRecord>;
  delete(id: number): Promise<boolean>;
}
