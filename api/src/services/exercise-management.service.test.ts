import { describe, it, expect, vi } from "vitest";
import { ExerciseManagementService } from "./exercise-management.service.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../domain/errors.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { AllowedFileRepository } from "../repositories/allowed-file.repository.js";
import { UserType } from "../lib/constants.js";

function makeExercise(overrides: Partial<ExerciseRecord> = {}): ExerciseRecord {
  return {
    id: 1,
    offeringId: 1,
    title: "Ex",
    description: null,
    deadline: new Date(Date.now() + 86_400_000),
    type: 0,
    openDate: new Date(),
    showBeforeOpening: false,
    removed: false,
    ghost: false,
    realId: null,
    ...overrides,
  };
}

function makeRepos(exercise: ExerciseRecord | null = makeExercise()) {
  const exercises: ExerciseRepository = {
    findById: vi.fn().mockResolvedValue(exercise),
    list: vi.fn(),
    listVisible: vi.fn(),
    countCases: vi.fn(),
    findAllowedExtensions: vi.fn(),
    create: vi.fn().mockResolvedValue(makeExercise()),
    update: vi.fn().mockResolvedValue(makeExercise({ title: "Updated" })),
    softDelete: vi.fn().mockResolvedValue(true),
    setAllowedFiles: vi.fn().mockResolvedValue(undefined),
  };
  const enrollments: EnrollmentRepository = {
    isEnrolled: vi.fn(),
    isStaff: vi.fn().mockResolvedValue(true),
    findOne: vi.fn(),
    listForUser: vi.fn(),
    listRecordsForUser: vi.fn(),
    listStaffForOfferings: vi.fn(),
    create: vi.fn(),
    setRole: vi.fn(),
    ban: vi.fn(),
    listStudentsForOffering: vi.fn(),
  };
  const allowedFiles: AllowedFileRepository = {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findByIds: vi.fn().mockImplementation((ids: number[]) =>
      Promise.resolve(
        ids.map((id) => ({
          id,
          name: "x",
          extension: "py",
          compilable: true,
          compileCommand: null,
          runCommand: null,
          available: true,
        })),
      ),
    ),
  };
  return { exercises, enrollments, allowedFiles };
}

const STAFF = { email: "prof@x.com", type: 0 };
const STUDENT = { email: "student@x.com", type: 0 };
const ADMIN = { email: "admin@x.com", type: UserType.ADMIN };

const CREATE_INPUT = {
  title: "New exercise",
  description: null,
  deadline: new Date(Date.now() + 86_400_000),
  openDate: new Date(),
  type: 0,
  showBeforeOpening: false,
  markdown: false,
  allowedFileIds: [] as number[],
};

describe("ExerciseManagementService.createExercise", () => {
  it("is forbidden for a non-staff, non-admin requester", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new ExerciseManagementService(repos.exercises, repos.enrollments, repos.allowedFiles);

    await expect(service.createExercise(1, STUDENT, CREATE_INPUT)).rejects.toThrow(ForbiddenError);
    expect(repos.exercises.create).not.toHaveBeenCalled();
  });

  it("allows staff and creates with the requester as author", async () => {
    const repos = makeRepos();
    const service = new ExerciseManagementService(repos.exercises, repos.enrollments, repos.allowedFiles);

    await service.createExercise(1, STAFF, CREATE_INPUT);

    expect(repos.exercises.create).toHaveBeenCalledWith(
      expect.objectContaining({ offeringId: 1, userEmail: STAFF.email }),
    );
  });

  it("rejects an allowedFileId that doesn't exist", async () => {
    const repos = makeRepos();
    repos.allowedFiles.findByIds = vi.fn().mockResolvedValue([]); // none found
    const service = new ExerciseManagementService(repos.exercises, repos.enrollments, repos.allowedFiles);

    await expect(
      service.createExercise(1, STAFF, { ...CREATE_INPUT, allowedFileIds: [999] }),
    ).rejects.toThrow(ValidationError);
  });

  it("links the allowed file ids after creating", async () => {
    const repos = makeRepos();
    const service = new ExerciseManagementService(repos.exercises, repos.enrollments, repos.allowedFiles);

    await service.createExercise(1, STAFF, { ...CREATE_INPUT, allowedFileIds: [1, 2] });

    expect(repos.exercises.setAllowedFiles).toHaveBeenCalledWith(1, [1, 2]);
  });

  it("allows an admin even without a staff enrollment", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new ExerciseManagementService(repos.exercises, repos.enrollments, repos.allowedFiles);

    await expect(service.createExercise(1, ADMIN, CREATE_INPUT)).resolves.toBeDefined();
  });
});

describe("ExerciseManagementService.updateExercise", () => {
  it("throws NotFoundError for a missing/removed exercise", async () => {
    const repos = makeRepos(null);
    const service = new ExerciseManagementService(repos.exercises, repos.enrollments, repos.allowedFiles);

    await expect(service.updateExercise(1, STAFF, { title: "x" })).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new ExerciseManagementService(repos.exercises, repos.enrollments, repos.allowedFiles);

    await expect(service.updateExercise(1, STUDENT, { title: "x" })).rejects.toThrow(ForbiddenError);
  });

  it("updates and returns the result", async () => {
    const repos = makeRepos();
    const service = new ExerciseManagementService(repos.exercises, repos.enrollments, repos.allowedFiles);

    const result = await service.updateExercise(1, STAFF, { title: "Updated" });
    expect(result.title).toBe("Updated");
  });
});

describe("ExerciseManagementService.deleteExercise", () => {
  it("throws NotFoundError for an already-removed exercise", async () => {
    const repos = makeRepos(makeExercise({ removed: true }));
    const service = new ExerciseManagementService(repos.exercises, repos.enrollments, repos.allowedFiles);

    await expect(service.deleteExercise(1, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("soft-deletes the real exercise id for a ghost clone", async () => {
    const repos = makeRepos(makeExercise({ ghost: true, realId: 77 }));
    const service = new ExerciseManagementService(repos.exercises, repos.enrollments, repos.allowedFiles);

    await service.deleteExercise(1, STAFF);

    expect(repos.exercises.softDelete).toHaveBeenCalledWith(77);
  });

  it("is forbidden for a plain student", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new ExerciseManagementService(repos.exercises, repos.enrollments, repos.allowedFiles);

    await expect(service.deleteExercise(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });
});
