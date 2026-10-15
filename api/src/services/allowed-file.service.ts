import type {
  AllowedFileRepository,
  AllowedFileRecord,
  NewAllowedFile,
  AllowedFilePatch,
} from "../repositories/allowed-file.repository.js";
import { NotFoundError } from "../domain/errors.js";

/** Mirrors AllowedFilesController — admin catalog of languages/file types
 * exercises can be configured to accept. Read is open to any
 * authenticated user (populating an exercise-creation form); writes are
 * admin-only, enforced at the route layer via requireMinType. */
export class AllowedFileService {
  constructor(private readonly allowedFiles: AllowedFileRepository) {}

  list(opts?: { compilable?: boolean; includeUnavailable?: boolean }): Promise<AllowedFileRecord[]> {
    return this.allowedFiles.list(opts);
  }

  async getById(id: number): Promise<AllowedFileRecord> {
    const file = await this.allowedFiles.findById(id);
    if (!file) throw new NotFoundError("Allowed file type not found");
    return file;
  }

  create(input: NewAllowedFile): Promise<AllowedFileRecord> {
    return this.allowedFiles.create(input);
  }

  async update(id: number, patch: AllowedFilePatch): Promise<AllowedFileRecord> {
    const updated = await this.allowedFiles.update(id, patch);
    if (!updated) throw new NotFoundError("Allowed file type not found");
    return updated;
  }
}
