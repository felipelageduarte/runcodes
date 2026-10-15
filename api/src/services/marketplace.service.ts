import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { OfferingRepository } from "../repositories/offering.repository.js";
import type { CourseRepository, CourseRecord } from "../repositories/course.repository.js";
import type { UniversityRepository } from "../repositories/university.repository.js";
import type { PublicExerciseRepository, PublicExerciseRecord } from "../repositories/public-exercise.repository.js";
import type { MarketplaceStatsService, DifficultyBucket } from "./marketplace-stats.service.js";
import { UserType } from "../lib/constants.js";
import { ForbiddenError, NotFoundError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

export type MarketplaceSortBy = "name" | "recent" | "difficulty" | "popularity";

export interface MarketplaceSearchFilter {
  search?: string;
  language?: string;
  universityId?: number;
  sortBy?: MarketplaceSortBy;
  sortDir?: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface PublicExerciseSummary {
  exerciseId: number;
  title: string;
  description: string | null;
  markdown: boolean;
  level: number | null;
  keywords: string | null;
  createdAt: Date;
  languages: string[];
  originUniversity: { id: number; name: string; abbreviation: string } | null;
  stats: Awaited<ReturnType<MarketplaceStatsService["getStats"]>>;
}

function difficultyRank(bucket: DifficultyBucket | null): number {
  switch (bucket) {
    case "easy":
      return 0;
    case "medium":
      return 1;
    case "hard":
      return 2;
    default:
      return -1; // unknown — sorts before everything in asc, after in desc
  }
}

/**
 * The marketplace's discovery layer (docs/frontend/marketplace.md) —
 * search/filter/sort over the existing public_exercises catalog. Reuse,
 * not reinvention: adoption itself is still ExerciseManagementService.
 * shareToOffering(), already existed before this service.
 *
 * Search/filter/sort runs in application code over the FULL catalog
 * (PublicExerciseRepository.listAll(), no DB-level pagination) — see
 * that method's doc comment for why. Sorting by difficulty/popularity
 * needs every entry's stats computed anyway (there's no column to
 * ORDER BY), so there's no cheaper path today without a materialized
 * view the doc explicitly says isn't justified yet.
 */
export class MarketplaceService {
  constructor(
    private readonly publicExercises: PublicExerciseRepository,
    private readonly exercises: ExerciseRepository,
    private readonly offerings: OfferingRepository,
    private readonly courses: CourseRepository,
    private readonly universities: UniversityRepository,
    private readonly marketplaceStats: MarketplaceStatsService,
  ) {}

  private requireProfessor(requester: Requester): void {
    if (requester.type < UserType.PROFESSOR) throw new ForbiddenError();
  }

  async search(
    filter: MarketplaceSearchFilter,
    requester: Requester,
  ): Promise<{ total: number; entries: PublicExerciseSummary[] }> {
    this.requireProfessor(requester);

    const allEntries = await this.publicExercises.listAll();
    let summaries = await this.buildSummaries(allEntries);

    if (filter.search) {
      const q = filter.search.toLowerCase();
      summaries = summaries.filter(
        (s) => s.title.toLowerCase().includes(q) || (s.keywords ?? "").toLowerCase().includes(q),
      );
    }
    if (filter.language) {
      const lang = filter.language.toLowerCase();
      summaries = summaries.filter((s) => s.languages.includes(lang));
    }
    if (filter.universityId !== undefined) {
      summaries = summaries.filter((s) => s.originUniversity?.id === filter.universityId);
    }

    const sortBy = filter.sortBy ?? "recent";
    const dir = filter.sortDir === "asc" ? 1 : -1;
    summaries = [...summaries].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return dir * a.title.localeCompare(b.title);
        case "difficulty":
          return dir * (difficultyRank(a.stats.difficultyBucket) - difficultyRank(b.stats.difficultyBucket));
        case "popularity":
          return dir * (a.stats.adoptionCount - b.stats.adoptionCount);
        case "recent":
        default:
          return dir * (a.createdAt.getTime() - b.createdAt.getTime());
      }
    });

    const total = summaries.length;
    const start = (filter.page - 1) * filter.pageSize;
    return { total, entries: summaries.slice(start, start + filter.pageSize) };
  }

  async getById(exerciseId: number, requester: Requester): Promise<PublicExerciseSummary> {
    this.requireProfessor(requester);

    const entry = await this.publicExercises.findByExerciseId(exerciseId);
    if (!entry) throw new NotFoundError("Exercise not published");

    const [summary] = await this.buildSummaries([entry]);
    if (!summary) throw new NotFoundError("Exercise not found");
    return summary;
  }

  private async buildSummaries(entries: PublicExerciseRecord[]): Promise<PublicExerciseSummary[]> {
    if (entries.length === 0) return [];

    const exerciseList = await this.exercises.findByIds(entries.map((e) => e.exerciseId));
    const exerciseById = new Map(exerciseList.map((e) => [e.id, e]));

    const offeringIds = [...new Set(exerciseList.map((e) => e.offeringId))];
    const offeringList = await this.offerings.findByIds(offeringIds);
    const offeringById = new Map(offeringList.map((o) => [o.id, o]));

    const courseIds = [...new Set(offeringList.map((o) => o.courseId))];
    const courseList = (await Promise.all(courseIds.map((id) => this.courses.findById(id)))).filter(
      (c): c is CourseRecord => c !== null,
    );
    const courseById = new Map(courseList.map((c) => [c.id, c]));

    const universityIds = [...new Set(courseList.map((c) => c.universityId))];
    const universityById = await this.universities.findByIds(universityIds);

    const results = await Promise.all(
      entries.map(async (entry): Promise<PublicExerciseSummary | null> => {
        const exercise = exerciseById.get(entry.exerciseId);
        if (!exercise || exercise.removed) return null;

        const [languages, stats] = await Promise.all([
          this.exercises.findAllowedExtensions(exercise.id),
          this.marketplaceStats.getStats(exercise.id),
        ]);

        const offering = offeringById.get(exercise.offeringId);
        const course = offering ? courseById.get(offering.courseId) : undefined;
        const university = course ? universityById.get(course.universityId) : undefined;

        return {
          exerciseId: exercise.id,
          title: exercise.title,
          description: exercise.description,
          markdown: exercise.markdown ?? false,
          level: entry.level,
          keywords: entry.keywords,
          createdAt: entry.createdAt,
          languages,
          originUniversity: university
            ? { id: university.id, name: university.name, abbreviation: university.abbreviation }
            : null,
          stats,
        };
      }),
    );

    return results.filter((r): r is PublicExerciseSummary => r !== null);
  }
}
