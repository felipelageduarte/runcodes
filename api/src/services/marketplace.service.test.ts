import { describe, it, expect, vi } from "vitest";
import { MarketplaceService } from "./marketplace.service.js";
import { ForbiddenError, NotFoundError } from "../domain/errors.js";
import { UserType } from "../lib/constants.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { OfferingRepository, OfferingRecord } from "../repositories/offering.repository.js";
import type { CourseRepository, CourseRecord } from "../repositories/course.repository.js";
import type { UniversityRepository, UniversityRecord } from "../repositories/university.repository.js";
import type { PublicExerciseRepository, PublicExerciseRecord } from "../repositories/public-exercise.repository.js";
import type { MarketplaceStatsService, ExerciseMarketplaceStats } from "./marketplace-stats.service.js";

function makeExercise(overrides: Partial<ExerciseRecord> = {}): ExerciseRecord {
  return {
    id: 1,
    offeringId: 1,
    title: "Exercise A",
    description: "desc",
    deadline: new Date(),
    type: 0,
    openDate: null,
    showBeforeOpening: false,
    removed: false,
    ghost: false,
    realId: null,
    markdown: false,
    ...overrides,
  };
}

function makePublicEntry(overrides: Partial<PublicExerciseRecord> = {}): PublicExerciseRecord {
  return {
    id: 1,
    exerciseId: 1,
    level: 1,
    obs: null,
    keywords: "loops",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeOffering(overrides: Partial<OfferingRecord> = {}): OfferingRecord {
  return {
    id: 1,
    courseId: 1,
    year: 2026,
    term: 1,
    classroom: null,
    endDate: new Date(),
    enrollmentCode: null,
    maxStudents: null,
    maxExercises: null,
    ...overrides,
  };
}

function makeCourse(overrides: Partial<CourseRecord> = {}): CourseRecord {
  return { id: 1, code: "CS101", title: "Intro", universityId: 1, ...overrides };
}

function makeUniversity(overrides: Partial<UniversityRecord> = {}): UniversityRecord {
  return { id: 1, abbreviation: "USP", name: "Universidade de São Paulo", studentIdentifierText: null, type: 1, state: "BR", ...overrides };
}

function makeStats(overrides: Partial<ExerciseMarketplaceStats> = {}): ExerciseMarketplaceStats {
  return {
    exerciseId: 1,
    adoptionCount: 0,
    totalSubmitters: 0,
    avgAttemptsToSuccess: 0,
    avgScore: 0,
    passRate: 0,
    difficultyBucket: null,
    ...overrides,
  };
}

function makeRepos() {
  const exercises: ExerciseRepository = {
    findById: vi.fn(),
    findByIds: vi.fn().mockImplementation((ids: number[]) => Promise.resolve(ids.map((id) => makeExercise({ id })))),
    findGhosts: vi.fn().mockResolvedValue([]),
    list: vi.fn(),
    listVisible: vi.fn(),
    countCases: vi.fn().mockResolvedValue(1),
    findAllowedExtensions: vi.fn().mockResolvedValue(["py"]),
    listAllowedFiles: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    setAllowedFiles: vi.fn(),
  };
  const offerings: OfferingRepository = {
    list: vi.fn(),
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([makeOffering()]),
    findByEnrollmentCode: vi.fn(),
  };
  const courses: CourseRepository = {
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(makeCourse()),
    searchByUniversity: vi.fn(),
  };
  const universities: UniversityRepository = {
    findByIds: vi.fn().mockResolvedValue(new Map([[1, makeUniversity()]])),
    findById: vi.fn(),
    list: vi.fn(),
    existsByAbbreviation: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const publicExercises: PublicExerciseRepository = {
    findByExerciseId: vi.fn(),
    create: vi.fn(),
    list: vi.fn(),
    listAll: vi.fn().mockResolvedValue([makePublicEntry()]),
  };
  const marketplaceStats = { getStats: vi.fn().mockResolvedValue(makeStats()) } as unknown as MarketplaceStatsService;

  return { exercises, offerings, courses, universities, publicExercises, marketplaceStats };
}

const PROFESSOR = { email: "prof@x.com", type: UserType.PROFESSOR };
const STUDENT = { email: "student@x.com", type: UserType.STUDENT };

describe("MarketplaceService.search", () => {
  it("is forbidden for a non-professor", async () => {
    const repos = makeRepos();
    const service = new MarketplaceService(
      repos.publicExercises,
      repos.exercises,
      repos.offerings,
      repos.courses,
      repos.universities,
      repos.marketplaceStats,
    );

    await expect(service.search({ page: 1, pageSize: 20 }, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("joins exercise, origin university, languages and stats into each entry", async () => {
    const repos = makeRepos();
    const service = new MarketplaceService(
      repos.publicExercises,
      repos.exercises,
      repos.offerings,
      repos.courses,
      repos.universities,
      repos.marketplaceStats,
    );

    const { total, entries } = await service.search({ page: 1, pageSize: 20 }, PROFESSOR);

    expect(total).toBe(1);
    expect(entries[0]).toMatchObject({
      exerciseId: 1,
      title: "Exercise A",
      languages: ["py"],
      originUniversity: { id: 1, abbreviation: "USP" },
    });
  });

  it("excludes a removed exercise from the catalog even if still published", async () => {
    const repos = makeRepos();
    repos.exercises.findByIds = vi.fn().mockResolvedValue([makeExercise({ removed: true })]);
    const service = new MarketplaceService(
      repos.publicExercises,
      repos.exercises,
      repos.offerings,
      repos.courses,
      repos.universities,
      repos.marketplaceStats,
    );

    const { entries } = await service.search({ page: 1, pageSize: 20 }, PROFESSOR);
    expect(entries).toHaveLength(0);
  });

  it("filters by search text across title and keywords", async () => {
    const repos = makeRepos();
    repos.publicExercises.listAll = vi.fn().mockResolvedValue([
      makePublicEntry({ exerciseId: 1, keywords: "loops" }),
      makePublicEntry({ id: 2, exerciseId: 2, keywords: "recursion" }),
    ]);
    repos.exercises.findByIds = vi.fn().mockResolvedValue([
      makeExercise({ id: 1, title: "Loop drills" }),
      makeExercise({ id: 2, title: "Fibonacci" }),
    ]);
    const service = new MarketplaceService(
      repos.publicExercises,
      repos.exercises,
      repos.offerings,
      repos.courses,
      repos.universities,
      repos.marketplaceStats,
    );

    const { entries } = await service.search({ search: "fibo", page: 1, pageSize: 20 }, PROFESSOR);
    expect(entries.map((e) => e.exerciseId)).toEqual([2]);
  });

  it("filters by language", async () => {
    const repos = makeRepos();
    repos.publicExercises.listAll = vi.fn().mockResolvedValue([
      makePublicEntry({ exerciseId: 1 }),
      makePublicEntry({ id: 2, exerciseId: 2 }),
    ]);
    repos.exercises.findByIds = vi.fn().mockResolvedValue([makeExercise({ id: 1 }), makeExercise({ id: 2 })]);
    repos.exercises.findAllowedExtensions = vi.fn().mockImplementation((id: number) =>
      Promise.resolve(id === 1 ? ["py"] : ["java"]),
    );
    const service = new MarketplaceService(
      repos.publicExercises,
      repos.exercises,
      repos.offerings,
      repos.courses,
      repos.universities,
      repos.marketplaceStats,
    );

    const { entries } = await service.search({ language: "java", page: 1, pageSize: 20 }, PROFESSOR);
    expect(entries.map((e) => e.exerciseId)).toEqual([2]);
  });

  it("filters by origin university", async () => {
    const repos = makeRepos();
    repos.publicExercises.listAll = vi.fn().mockResolvedValue([
      makePublicEntry({ exerciseId: 1 }),
      makePublicEntry({ id: 2, exerciseId: 2 }),
    ]);
    repos.exercises.findByIds = vi.fn().mockResolvedValue([
      makeExercise({ id: 1, offeringId: 1 }),
      makeExercise({ id: 2, offeringId: 2 }),
    ]);
    repos.offerings.findByIds = vi.fn().mockResolvedValue([makeOffering({ id: 1, courseId: 1 }), makeOffering({ id: 2, courseId: 2 })]);
    repos.courses.findById = vi.fn().mockImplementation((id: number) =>
      Promise.resolve(id === 1 ? makeCourse({ id: 1, universityId: 1 }) : makeCourse({ id: 2, universityId: 2 })),
    );
    repos.universities.findByIds = vi.fn().mockResolvedValue(
      new Map([
        [1, makeUniversity({ id: 1 })],
        [2, makeUniversity({ id: 2, abbreviation: "UFMG" })],
      ]),
    );

    const service = new MarketplaceService(
      repos.publicExercises,
      repos.exercises,
      repos.offerings,
      repos.courses,
      repos.universities,
      repos.marketplaceStats,
    );

    const { entries } = await service.search({ universityId: 2, page: 1, pageSize: 20 }, PROFESSOR);
    expect(entries.map((e) => e.exerciseId)).toEqual([2]);
  });

  it("sorts by name ascending", async () => {
    const repos = makeRepos();
    repos.publicExercises.listAll = vi.fn().mockResolvedValue([
      makePublicEntry({ exerciseId: 1 }),
      makePublicEntry({ id: 2, exerciseId: 2 }),
    ]);
    repos.exercises.findByIds = vi.fn().mockResolvedValue([
      makeExercise({ id: 1, title: "Zebra" }),
      makeExercise({ id: 2, title: "Apple" }),
    ]);
    const service = new MarketplaceService(
      repos.publicExercises,
      repos.exercises,
      repos.offerings,
      repos.courses,
      repos.universities,
      repos.marketplaceStats,
    );

    const { entries } = await service.search({ sortBy: "name", sortDir: "asc", page: 1, pageSize: 20 }, PROFESSOR);
    expect(entries.map((e) => e.title)).toEqual(["Apple", "Zebra"]);
  });

  it("sorts by popularity (adoption count) descending by default", async () => {
    const repos = makeRepos();
    repos.publicExercises.listAll = vi.fn().mockResolvedValue([
      makePublicEntry({ exerciseId: 1 }),
      makePublicEntry({ id: 2, exerciseId: 2 }),
    ]);
    repos.exercises.findByIds = vi.fn().mockResolvedValue([makeExercise({ id: 1 }), makeExercise({ id: 2 })]);
    repos.marketplaceStats.getStats = vi.fn().mockImplementation((exerciseId: number) =>
      Promise.resolve(makeStats({ exerciseId, adoptionCount: exerciseId === 1 ? 1 : 9 })),
    );

    const service = new MarketplaceService(
      repos.publicExercises,
      repos.exercises,
      repos.offerings,
      repos.courses,
      repos.universities,
      repos.marketplaceStats,
    );

    const { entries } = await service.search({ sortBy: "popularity", page: 1, pageSize: 20 }, PROFESSOR);
    expect(entries.map((e) => e.exerciseId)).toEqual([2, 1]);
  });

  it("paginates the filtered/sorted result", async () => {
    const repos = makeRepos();
    repos.publicExercises.listAll = vi.fn().mockResolvedValue([
      makePublicEntry({ exerciseId: 1 }),
      makePublicEntry({ id: 2, exerciseId: 2 }),
      makePublicEntry({ id: 3, exerciseId: 3 }),
    ]);
    repos.exercises.findByIds = vi.fn().mockResolvedValue([
      makeExercise({ id: 1, title: "A" }),
      makeExercise({ id: 2, title: "B" }),
      makeExercise({ id: 3, title: "C" }),
    ]);
    const service = new MarketplaceService(
      repos.publicExercises,
      repos.exercises,
      repos.offerings,
      repos.courses,
      repos.universities,
      repos.marketplaceStats,
    );

    const { total, entries } = await service.search(
      { sortBy: "name", sortDir: "asc", page: 2, pageSize: 2 },
      PROFESSOR,
    );
    expect(total).toBe(3);
    expect(entries.map((e) => e.title)).toEqual(["C"]);
  });
});

describe("MarketplaceService.getById", () => {
  it("throws NotFoundError when the exercise isn't published", async () => {
    const repos = makeRepos();
    repos.publicExercises.findByExerciseId = vi.fn().mockResolvedValue(null);
    const service = new MarketplaceService(
      repos.publicExercises,
      repos.exercises,
      repos.offerings,
      repos.courses,
      repos.universities,
      repos.marketplaceStats,
    );

    await expect(service.getById(1, PROFESSOR)).rejects.toThrow(NotFoundError);
  });

  it("returns the full summary for a published exercise", async () => {
    const repos = makeRepos();
    repos.publicExercises.findByExerciseId = vi.fn().mockResolvedValue(makePublicEntry());
    const service = new MarketplaceService(
      repos.publicExercises,
      repos.exercises,
      repos.offerings,
      repos.courses,
      repos.universities,
      repos.marketplaceStats,
    );

    const summary = await service.getById(1, PROFESSOR);
    expect(summary.title).toBe("Exercise A");
  });
});
