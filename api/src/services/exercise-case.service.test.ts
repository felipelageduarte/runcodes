import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { ExerciseCaseService } from "./exercise-case.service.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../domain/errors.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { ExerciseCaseRepository, ExerciseCaseRecord } from "../repositories/exercise-case.repository.js";
import type { CaseStorageRepository } from "../repositories/case-storage.repository.js";

function md5(s: string) {
  return createHash("md5").update(s).digest("hex");
}

function makeExercise(overrides: Partial<ExerciseRecord> = {}): ExerciseRecord {
  return {
    id: 1,
    offeringId: 1,
    title: "Ex",
    description: null,
    deadline: new Date(Date.now() + 86_400_000),
    type: 0, // compilable
    openDate: new Date(),
    showBeforeOpening: false,
    removed: false,
    ghost: false,
    realId: null,
    ...overrides,
  };
}

const CASE_RECORD: ExerciseCaseRecord = {
  id: 10,
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
  inputMd5: md5("in"),
  outputMd5: md5("out"),
};

function makeRepos(exercise: ExerciseRecord | null = makeExercise()) {
  const exercises: ExerciseRepository = {
    findById: vi.fn().mockResolvedValue(exercise),
    list: vi.fn(),
    listVisible: vi.fn(),
    countCases: vi.fn(),
    findAllowedExtensions: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    setAllowedFiles: vi.fn(),
  };
  const enrollments: EnrollmentRepository = {
    isEnrolled: vi.fn().mockResolvedValue(true),
    isStaff: vi.fn().mockResolvedValue(true),
    findOne: vi.fn(),
    listForUser: vi.fn(),
    listRecordsForUser: vi.fn(),
    listStaffForOfferings: vi.fn(),
    create: vi.fn(),
    setRole: vi.fn(),
    ban: vi.fn(),
  };
  const cases: ExerciseCaseRepository = {
    findById: vi.fn().mockResolvedValue(CASE_RECORD),
    listForExercise: vi.fn().mockResolvedValue([CASE_RECORD]),
    create: vi.fn().mockResolvedValue(CASE_RECORD),
    update: vi.fn().mockResolvedValue({ ...CASE_RECORD, cputime: 5 }),
    delete: vi.fn().mockResolvedValue(true),
  };
  const storage: CaseStorageRepository = {
    putInput: vi.fn().mockResolvedValue(undefined),
    putOutput: vi.fn().mockResolvedValue(undefined),
    getInput: vi.fn(),
    getOutput: vi.fn(),
    deleteCase: vi.fn().mockResolvedValue(undefined),
  };
  return { exercises, enrollments, cases, storage };
}

const STAFF = { email: "prof@x.com", type: 0 };
const STUDENT = { email: "student@x.com", type: 0 };

const CREATE_INPUT = {
  input: "1 2",
  output: "3",
  outputType: 1,
  showInput: false,
  showExpectedOutput: false,
  showUserOutput: false,
  cputime: 1,
};

describe("ExerciseCaseService.createCase", () => {
  it("throws NotFoundError for a missing exercise", async () => {
    const repos = makeRepos(null);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.createCase(1, STAFF, CREATE_INPUT)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.createCase(1, STUDENT, CREATE_INPUT)).rejects.toThrow(ForbiddenError);
  });

  it("rejects adding a case to a non-compilable (type=1) exercise", async () => {
    const repos = makeRepos(makeExercise({ type: 1 }));
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    const promise = service.createCase(1, STAFF, CREATE_INPUT);
    await expect(promise).rejects.toThrow(ValidationError);
    await expect(promise).rejects.toMatchObject({ code: "cases_not_supported_for_exercise_type" });
  });

  it("creates with correct md5 hashes and uploads input/output to S3", async () => {
    const repos = makeRepos();
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await service.createCase(1, STAFF, CREATE_INPUT);

    expect(repos.cases.create).toHaveBeenCalledWith(
      expect.objectContaining({ inputMd5: md5("1 2"), outputMd5: md5("3") }),
    );
    expect(repos.storage.putInput).toHaveBeenCalledWith(CASE_RECORD.id, "1 2");
    expect(repos.storage.putOutput).toHaveBeenCalledWith(CASE_RECORD.id, "3");
  });

  it("redirects a ghost exercise's case to the real exercise id", async () => {
    const repos = makeRepos(makeExercise({ ghost: true, realId: 42 }));
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await service.createCase(1, STAFF, CREATE_INPUT);

    expect(repos.cases.create).toHaveBeenCalledWith(expect.objectContaining({ exerciseId: 42 }));
  });

  it("rolls back the DB row when the S3 upload fails", async () => {
    const repos = makeRepos();
    repos.storage.putInput = vi.fn().mockRejectedValue(new Error("s3 down"));
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.createCase(1, STAFF, CREATE_INPUT)).rejects.toThrow("s3 down");
    expect(repos.cases.delete).toHaveBeenCalledWith(CASE_RECORD.id);
  });

  it("fills in the legacy hardcoded defaults for maxmemsize/stacksize when omitted", async () => {
    const repos = makeRepos();
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await service.createCase(1, STAFF, CREATE_INPUT);

    expect(repos.cases.create).toHaveBeenCalledWith(
      expect.objectContaining({ maxmemsize: 4096, stacksize: 2048, fileSize: 10000 }),
    );
  });
});

describe("ExerciseCaseService.updateCase", () => {
  it("throws NotFoundError for a missing case", async () => {
    const repos = makeRepos();
    repos.cases.findById = vi.fn().mockResolvedValue(null);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.updateCase(10, STAFF, { cputime: 5 })).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.updateCase(10, STUDENT, { cputime: 5 })).rejects.toThrow(ForbiddenError);
  });

  it("re-uploads to S3 and recomputes the hash only for fields actually changed", async () => {
    const repos = makeRepos();
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await service.updateCase(10, STAFF, { input: "new input" });

    expect(repos.storage.putInput).toHaveBeenCalledWith(10, "new input");
    expect(repos.storage.putOutput).not.toHaveBeenCalled();
    expect(repos.cases.update).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ inputMd5: md5("new input"), outputMd5: undefined }),
    );
  });
});

describe("ExerciseCaseService.deleteCase", () => {
  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.deleteCase(10, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("deletes the DB row then best-effort cleans up S3", async () => {
    const repos = makeRepos();
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await service.deleteCase(10, STAFF);

    expect(repos.cases.delete).toHaveBeenCalledWith(10);
    expect(repos.storage.deleteCase).toHaveBeenCalledWith(10);
  });
});

describe("ExerciseCaseService.listForExercise", () => {
  it("is forbidden for someone with no enrollment at all", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    repos.enrollments.isEnrolled = vi.fn().mockResolvedValue(false);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.listForExercise(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("allows an enrolled student (metadata only, no case content)", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    const result = await service.listForExercise(1, STUDENT);
    expect(result).toEqual([CASE_RECORD]);
  });
});
