import { describe, it, expect, vi } from "vitest";
import { ExerciseManagementService } from "./exercise-management.service.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../domain/errors.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { AllowedFileRepository } from "../repositories/allowed-file.repository.js";
import type { PublicExerciseRepository } from "../repositories/public-exercise.repository.js";
import type { ExerciseCaseRepository, ExerciseCaseRecord } from "../repositories/exercise-case.repository.js";
import type { CaseStorageRepository } from "../repositories/case-storage.repository.js";
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
    markdown: false,
    ...overrides,
  };
}

function makeRepos(exercise: ExerciseRecord | null = makeExercise()) {
  const exercises: ExerciseRepository = {
    findById: vi.fn().mockResolvedValue(exercise),
    findByIds: vi.fn().mockResolvedValue([]),
    findGhosts: vi.fn().mockResolvedValue([]),
    list: vi.fn(),
    listVisible: vi.fn(),
    countCases: vi.fn(),
    findAllowedExtensions: vi.fn(),
    listAllowedFiles: vi.fn().mockResolvedValue([]),
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
  const publicExercises: PublicExerciseRepository = {
    findByExerciseId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    list: vi.fn(),
    listAll: vi.fn().mockResolvedValue([]),
  };
  const exerciseCases: ExerciseCaseRepository = {
    findById: vi.fn(),
    listForExercise: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((input) =>
      Promise.resolve({ ...CASE_RECORD, id: Math.random(), exerciseId: input.exerciseId }),
    ),
    createMany: vi.fn(),
    update: vi.fn(),
    updateVisibilityForExercise: vi.fn(),
    delete: vi.fn(),
    deleteAllForExercise: vi.fn(),
    maxLastUpdate: vi.fn(),
  };
  const caseStorage: CaseStorageRepository = {
    putInput: vi.fn().mockResolvedValue(undefined),
    putOutput: vi.fn().mockResolvedValue(undefined),
    getInput: vi.fn().mockResolvedValue("1 2"),
    getOutput: vi.fn().mockResolvedValue("3"),
    putFile: vi.fn(),
    getFile: vi.fn(),
    deleteFile: vi.fn(),
    deleteCase: vi.fn(),
  };
  return { exercises, enrollments, allowedFiles, publicExercises, exerciseCases, caseStorage };
}

function buildService(repos: ReturnType<typeof makeRepos>) {
  return new ExerciseManagementService(
    repos.exercises,
    repos.enrollments,
    repos.allowedFiles,
    repos.publicExercises,
    repos.exerciseCases,
    repos.caseStorage,
  );
}

const CASE_RECORD: ExerciseCaseRecord = {
  id: 100,
  exerciseId: 1,
  outputType: 1,
  showInput: false,
  showExpectedOutput: false,
  showUserOutput: false,
  cputime: 1,
  maxmemsize: 4096,
  stacksize: 2048,
  fileSize: 10000,
  absError: null,
  inputMd5: "a",
  outputMd5: "b",
};

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
    const service = buildService(repos);

    await expect(service.createExercise(1, STUDENT, CREATE_INPUT)).rejects.toThrow(ForbiddenError);
    expect(repos.exercises.create).not.toHaveBeenCalled();
  });

  it("allows staff and creates with the requester as author", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await service.createExercise(1, STAFF, CREATE_INPUT);

    expect(repos.exercises.create).toHaveBeenCalledWith(
      expect.objectContaining({ offeringId: 1, userEmail: STAFF.email }),
    );
  });

  it("rejects an allowedFileId that doesn't exist", async () => {
    const repos = makeRepos();
    repos.allowedFiles.findByIds = vi.fn().mockResolvedValue([]); // none found
    const service = buildService(repos);

    await expect(
      service.createExercise(1, STAFF, { ...CREATE_INPUT, allowedFileIds: [999] }),
    ).rejects.toThrow(ValidationError);
  });

  it("links the allowed file ids after creating", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await service.createExercise(1, STAFF, { ...CREATE_INPUT, allowedFileIds: [1, 2] });

    expect(repos.exercises.setAllowedFiles).toHaveBeenCalledWith(1, [1, 2]);
  });

  it("allows an admin even without a staff enrollment", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = buildService(repos);

    await expect(service.createExercise(1, ADMIN, CREATE_INPUT)).resolves.toBeDefined();
  });
});

describe("ExerciseManagementService.updateExercise", () => {
  it("throws NotFoundError for a missing/removed exercise", async () => {
    const repos = makeRepos(null);
    const service = buildService(repos);

    await expect(service.updateExercise(1, STAFF, { title: "x" })).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = buildService(repos);

    await expect(service.updateExercise(1, STUDENT, { title: "x" })).rejects.toThrow(ForbiddenError);
  });

  it("updates and returns the result", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const result = await service.updateExercise(1, STAFF, { title: "Updated" });
    expect(result.title).toBe("Updated");
  });
});

describe("ExerciseManagementService.deleteExercise", () => {
  it("throws NotFoundError for an already-removed exercise", async () => {
    const repos = makeRepos(makeExercise({ removed: true }));
    const service = buildService(repos);

    await expect(service.deleteExercise(1, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("soft-deletes the real exercise id for a ghost clone", async () => {
    const repos = makeRepos(makeExercise({ ghost: true, realId: 77 }));
    const service = buildService(repos);

    await service.deleteExercise(1, STAFF);

    expect(repos.exercises.softDelete).toHaveBeenCalledWith(77);
  });

  it("is forbidden for a plain student", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = buildService(repos);

    await expect(service.deleteExercise(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });
});

describe("ExerciseManagementService.shareToOffering", () => {
  it("is forbidden for a non-staff requester of the target offering", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = buildService(repos);

    await expect(service.shareToOffering(1, 99, STUDENT)).rejects.toThrow(ForbiddenError);
    expect(repos.exercises.create).not.toHaveBeenCalled();
  });

  it("throws NotFoundError for a missing/removed source exercise", async () => {
    const repos = makeRepos(null);
    const service = buildService(repos);

    await expect(service.shareToOffering(1, 99, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("clones a non-ghost exercise into the target offering", async () => {
    const source = makeExercise({ id: 1, title: "Original", type: 0 });
    const repos = makeRepos(source);
    const service = buildService(repos);

    await service.shareToOffering(1, 99, STAFF);

    expect(repos.exercises.create).toHaveBeenCalledWith(
      expect.objectContaining({
        offeringId: 99,
        title: "Original",
        ghost: true,
        realId: 1,
        userEmail: STAFF.email,
      }),
    );
  });

  it("resolves a ghost source to its real exercise before cloning", async () => {
    const ghostSource = makeExercise({ id: 5, ghost: true, realId: 1 });
    const real = makeExercise({ id: 1, title: "Real one" });
    const repos = makeRepos(ghostSource);
    repos.exercises.findById = vi.fn().mockImplementation((id: number) =>
      Promise.resolve(id === 5 ? ghostSource : real),
    );
    const service = buildService(repos);

    await service.shareToOffering(5, 99, STAFF);

    expect(repos.exercises.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Real one", realId: 1 }),
    );
  });

  it("allows an admin even without staff enrollment in the target offering", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = buildService(repos);

    await expect(service.shareToOffering(1, 99, ADMIN)).resolves.toBeDefined();
  });

  it("is forbidden when the source isn't public and requester isn't staff of the source offering", async () => {
    const source = makeExercise({ id: 1, offeringId: 1 });
    const repos = makeRepos(source);
    repos.publicExercises.findByExerciseId = vi.fn().mockResolvedValue(null);
    // Staff of the target (99) but not of the source (1) — a staff
    // member of someone else's turma, exactly the gap being closed.
    repos.enrollments.isStaff = vi.fn().mockImplementation((_email: string, offeringId: number) =>
      Promise.resolve(offeringId === 99),
    );
    const service = buildService(repos);

    await expect(service.shareToOffering(1, 99, STAFF)).rejects.toThrow(ForbiddenError);
    expect(repos.exercises.create).not.toHaveBeenCalled();
  });

  it("allows sharing a published exercise even without staff enrollment in the source offering", async () => {
    const source = makeExercise({ id: 1, offeringId: 1 });
    const repos = makeRepos(source);
    repos.publicExercises.findByExerciseId = vi.fn().mockResolvedValue({
      id: 1,
      exerciseId: 1,
      level: 1,
      obs: null,
      keywords: null,
      createdAt: new Date(),
    });
    repos.enrollments.isStaff = vi.fn().mockImplementation((_email: string, offeringId: number) =>
      Promise.resolve(offeringId === 99),
    );
    const service = buildService(repos);

    await expect(service.shareToOffering(1, 99, STAFF)).resolves.toBeDefined();
  });

  it("allows sharing when requester is staff of the source offering even if not published", async () => {
    const source = makeExercise({ id: 1, offeringId: 1 });
    const repos = makeRepos(source);
    repos.publicExercises.findByExerciseId = vi.fn().mockResolvedValue(null);
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true); // staff everywhere, including offering 1
    const service = buildService(repos);

    await expect(service.shareToOffering(1, 99, STAFF)).resolves.toBeDefined();
  });
});

describe("ExerciseManagementService.cloneExercise", () => {
  it("throws NotFoundError for a missing/removed exercise", async () => {
    const repos = makeRepos(null);
    const service = buildService(repos);

    await expect(service.cloneExercise(1, 99, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for staff of neither the target nor the source offering", async () => {
    const source = makeExercise({ id: 1, offeringId: 1 });
    const repos = makeRepos(source);
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    repos.publicExercises.findByExerciseId = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(service.cloneExercise(1, 99, STAFF)).rejects.toThrow(ForbiddenError);
    expect(repos.exercises.create).not.toHaveBeenCalled();
  });

  it("creates an independent copy (not a ghost) titled '<original> (cópia)'", async () => {
    const source = makeExercise({ id: 1, offeringId: 1, title: "Soma" });
    const repos = makeRepos(source);
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    await service.cloneExercise(1, 99, STAFF);

    expect(repos.exercises.create).toHaveBeenCalledWith(
      expect.objectContaining({ offeringId: 99, title: "Soma (cópia)", userEmail: STAFF.email }),
    );
    const call = (repos.exercises.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.ghost).toBeUndefined();
  });

  it("copies allowed file ids from the source onto the clone", async () => {
    const repos = makeRepos();
    repos.exercises.listAllowedFiles = vi.fn().mockResolvedValue([{ id: 5 }, { id: 6 }]);
    const service = buildService(repos);

    await service.cloneExercise(1, 99, STAFF);

    expect(repos.exercises.setAllowedFiles).toHaveBeenCalledWith(expect.any(Number), [5, 6]);
  });

  it("duplicates every case's input/output content onto new case rows", async () => {
    const repos = makeRepos();
    repos.exerciseCases.listForExercise = vi.fn().mockResolvedValue([
      { ...CASE_RECORD, id: 10 },
      { ...CASE_RECORD, id: 11 },
    ]);
    repos.caseStorage.getInput = vi.fn().mockImplementation((id: number) => Promise.resolve(`in-${id}`));
    repos.caseStorage.getOutput = vi.fn().mockImplementation((id: number) => Promise.resolve(`out-${id}`));
    const service = buildService(repos);

    await service.cloneExercise(1, 99, STAFF);

    expect(repos.exerciseCases.create).toHaveBeenCalledTimes(2);
    expect(repos.caseStorage.getInput).toHaveBeenCalledWith(10);
    expect(repos.caseStorage.getInput).toHaveBeenCalledWith(11);
    expect(repos.caseStorage.putInput).toHaveBeenCalledTimes(2);
    expect(repos.caseStorage.putOutput).toHaveBeenCalledTimes(2);
  });

  it("redirects a ghost source to the real exercise's cases", async () => {
    const source = makeExercise({ id: 2, ghost: true, realId: 1, offeringId: 1 });
    const repos = makeRepos(source);
    repos.exercises.findById = vi.fn().mockImplementation((id: number) =>
      Promise.resolve(id === 2 ? source : makeExercise({ id: 1, offeringId: 1 })),
    );
    const service = buildService(repos);

    await service.cloneExercise(2, 99, STAFF);

    expect(repos.exerciseCases.listForExercise).toHaveBeenCalledWith(1);
  });
});
