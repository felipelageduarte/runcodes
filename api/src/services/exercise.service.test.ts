import { describe, it, expect, vi } from "vitest";
import { ExerciseService } from "./exercise.service.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import { UserType } from "../lib/constants.js";

function makeExercise(overrides: Partial<ExerciseRecord> = {}): ExerciseRecord {
  return {
    id: 1,
    offeringId: 1,
    title: "Ex",
    description: null,
    deadline: new Date(Date.now() + 86_400_000),
    type: 0,
    openDate: new Date(Date.now() - 1000),
    showBeforeOpening: false,
    removed: false,
    ghost: false,
    realId: null,
    markdown: false,
    ...overrides,
  };
}

function makeRepos(exercise: ExerciseRecord | null) {
  const exercises: ExerciseRepository = {
    findById: vi.fn().mockResolvedValue(exercise),
    list: vi.fn().mockResolvedValue({ total: 0, exercises: [] }),
    listVisible: vi.fn(),
    countCases: vi.fn().mockResolvedValue(3),
    findAllowedExtensions: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    setAllowedFiles: vi.fn(),
  };
  const enrollments: EnrollmentRepository = {
    isEnrolled: vi.fn().mockResolvedValue(false),
    isStaff: vi.fn().mockResolvedValue(false),
    findOne: vi.fn(),
    listForUser: vi.fn(),
    listRecordsForUser: vi.fn(),
    listStaffForOfferings: vi.fn(),
    create: vi.fn(),
    setRole: vi.fn(),
    ban: vi.fn(),
    listStudentsForOffering: vi.fn(),
  };
  return { exercises, enrollments };
}

describe("ExerciseService.getDetail", () => {
  it("throws NotFoundError when the exercise doesn't exist", async () => {
    const repos = makeRepos(null);
    const service = new ExerciseService(repos.exercises, repos.enrollments);

    await expect(service.getDetail(1, { email: "s@x.com", type: 0 })).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the exercise was removed", async () => {
    const repos = makeRepos(makeExercise({ removed: true }));
    const service = new ExerciseService(repos.exercises, repos.enrollments);

    await expect(service.getDetail(1, { email: "s@x.com", type: 0 })).rejects.toThrow(NotFoundError);
  });

  it("throws ForbiddenError for a user with no enrollment in the offering", async () => {
    const repos = makeRepos(makeExercise());
    const service = new ExerciseService(repos.exercises, repos.enrollments);

    await expect(service.getDetail(1, { email: "s@x.com", type: 0 })).rejects.toThrow(ForbiddenError);
  });

  it("hides (404s) an unopened exercise from an enrolled student", async () => {
    const repos = makeRepos(
      makeExercise({ openDate: new Date(Date.now() + 86_400_000), showBeforeOpening: false }),
    );
    repos.enrollments.isEnrolled = vi.fn().mockResolvedValue(true);
    const service = new ExerciseService(repos.exercises, repos.enrollments);

    await expect(service.getDetail(1, { email: "s@x.com", type: 0 })).rejects.toThrow(NotFoundError);
  });

  it("shows an unopened exercise to staff", async () => {
    const repos = makeRepos(makeExercise({ openDate: new Date(Date.now() + 86_400_000) }));
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = new ExerciseService(repos.exercises, repos.enrollments);

    const result = await service.getDetail(1, { email: "p@x.com", type: 0 });

    expect(result.isOpen).toBe(false);
    expect(result.casesCount).toBe(3);
  });

  it("shows an open exercise to an enrolled student", async () => {
    const repos = makeRepos(makeExercise());
    repos.enrollments.isEnrolled = vi.fn().mockResolvedValue(true);
    const service = new ExerciseService(repos.exercises, repos.enrollments);

    const result = await service.getDetail(1, { email: "s@x.com", type: 0 });

    expect(result.isOpen).toBe(true);
  });

  it("always allows an admin, regardless of enrollment", async () => {
    const repos = makeRepos(makeExercise());
    const service = new ExerciseService(repos.exercises, repos.enrollments);

    await service.getDetail(1, { email: "admin@x.com", type: UserType.ADMIN });

    expect(repos.enrollments.isEnrolled).not.toHaveBeenCalled();
  });
});

describe("ExerciseService.requireOfferingId", () => {
  it("throws NotFoundError when missing/removed", async () => {
    const repos = makeRepos(null);
    const service = new ExerciseService(repos.exercises, repos.enrollments);

    await expect(service.requireOfferingId(1)).rejects.toThrow(NotFoundError);
  });

  it("returns the owning offering id", async () => {
    const repos = makeRepos(makeExercise({ offeringId: 42 }));
    const service = new ExerciseService(repos.exercises, repos.enrollments);

    await expect(service.requireOfferingId(1)).resolves.toBe(42);
  });
});
