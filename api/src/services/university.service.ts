import type {
  UniversityRepository,
  UniversityRecord,
  NewUniversity,
  UniversityPatch,
} from "../repositories/university.repository.js";
import { NotFoundError, ConflictError } from "../domain/errors.js";

/** Mirrors UniversitiesController. List is public (no requireAuth in the
 * route) — a signup form needs it before the user has an account. */
export class UniversityService {
  constructor(private readonly universities: UniversityRepository) {}

  list(): Promise<UniversityRecord[]> {
    return this.universities.list();
  }

  async getById(id: number): Promise<UniversityRecord> {
    const university = await this.universities.findById(id);
    if (!university) throw new NotFoundError("University not found");
    return university;
  }

  async create(input: NewUniversity): Promise<UniversityRecord> {
    if (await this.universities.existsByAbbreviation(input.abbreviation)) {
      throw new ConflictError(
        "A university with this abbreviation already exists",
        "abbreviation_already_exists",
      );
    }
    return this.universities.create(input);
  }

  async update(id: number, patch: UniversityPatch): Promise<UniversityRecord> {
    if (patch.abbreviation && (await this.universities.existsByAbbreviation(patch.abbreviation))) {
      const existing = await this.universities.findById(id);
      if (existing?.abbreviation !== patch.abbreviation) {
        throw new ConflictError(
          "A university with this abbreviation already exists",
          "abbreviation_already_exists",
        );
      }
    }
    const updated = await this.universities.update(id, patch);
    if (!updated) throw new NotFoundError("University not found");
    return updated;
  }
}
