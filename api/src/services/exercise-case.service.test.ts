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
    markdown: false,
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
    findByIds: vi.fn().mockResolvedValue([]),
    findGhosts: vi.fn().mockResolvedValue([]),
    list: vi.fn(),
    listVisible: vi.fn(),
    countCases: vi.fn(),
    findAllowedExtensions: vi.fn(),
    listAllowedFiles: vi.fn().mockResolvedValue([]),
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
    listStudentsForOffering: vi.fn(),
  };
  const cases: ExerciseCaseRepository = {
    findById: vi.fn().mockResolvedValue(CASE_RECORD),
    listForExercise: vi.fn().mockResolvedValue([CASE_RECORD]),
    create: vi.fn().mockResolvedValue(CASE_RECORD),
    createMany: vi.fn().mockResolvedValue([CASE_RECORD]),
    update: vi.fn().mockResolvedValue({ ...CASE_RECORD, cputime: 5 }),
    updateVisibilityForExercise: vi.fn().mockResolvedValue(0),
    delete: vi.fn().mockResolvedValue(true),
    deleteAllForExercise: vi.fn().mockResolvedValue(0),
    maxLastUpdate: vi.fn().mockResolvedValue(null),
  };
  const storage: CaseStorageRepository = {
    putInput: vi.fn().mockResolvedValue(undefined),
    putOutput: vi.fn().mockResolvedValue(undefined),
    getInput: vi.fn().mockResolvedValue("1 2"),
    getOutput: vi.fn().mockResolvedValue("3"),
    putFile: vi.fn(),
    getFile: vi.fn(),
    deleteFile: vi.fn(),
    deleteCase: vi.fn().mockResolvedValue(undefined),
  };
  return { exercises, enrollments, cases, storage };
}

const STAFF = { email: "prof@x.com", type: 0 };
const STUDENT = { email: "student@x.com", type: 0 };

async function drain(archive: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of archive) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

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

  it("redirects a ghost exercise's case list to the real exercise id", async () => {
    const repos = makeRepos(makeExercise({ ghost: true, realId: 42 }));
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await service.listForExercise(1, STAFF);

    expect(repos.cases.listForExercise).toHaveBeenCalledWith(42);
  });
});

describe("ExerciseCaseService.createBatch", () => {
  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.createBatch(1, STUDENT, [CREATE_INPUT, CREATE_INPUT])).rejects.toThrow(ForbiddenError);
  });

  it("rejects a non-compilable exercise", async () => {
    const repos = makeRepos(makeExercise({ type: 1 }));
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.createBatch(1, STAFF, [CREATE_INPUT])).rejects.toMatchObject({
      code: "cases_not_supported_for_exercise_type",
    });
  });

  it("creates every case in the batch against the resolved exercise id", async () => {
    const repos = makeRepos(makeExercise({ ghost: true, realId: 42 }));
    repos.cases.create = vi.fn().mockImplementation((input) =>
      Promise.resolve({ ...CASE_RECORD, id: Math.random(), exerciseId: input.exerciseId }),
    );
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    const result = await service.createBatch(1, STAFF, [CREATE_INPUT, { ...CREATE_INPUT, cputime: 2 }]);

    expect(result).toHaveLength(2);
    expect(result.every((c) => c.exerciseId === 42)).toBe(true);
    expect(repos.storage.putInput).toHaveBeenCalledTimes(2);
  });

  it("stops at the first failure, leaving earlier cases created", async () => {
    const repos = makeRepos();
    let calls = 0;
    repos.cases.create = vi.fn().mockImplementation(() => {
      calls += 1;
      return Promise.resolve({ ...CASE_RECORD, id: calls });
    });
    repos.storage.putInput = vi.fn().mockImplementation(() => {
      if (calls === 2) return Promise.reject(new Error("s3 down"));
      return Promise.resolve(undefined);
    });
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.createBatch(1, STAFF, [CREATE_INPUT, CREATE_INPUT, CREATE_INPUT])).rejects.toThrow(
      "s3 down",
    );
    expect(repos.cases.delete).toHaveBeenCalledWith(2);
  });
});

describe("ExerciseCaseService.setVisibilityForAll", () => {
  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.setVisibilityForAll(1, STUDENT, { showInput: true })).rejects.toThrow(ForbiddenError);
  });

  it("applies the patch to every case of the resolved exercise id and returns the count", async () => {
    const repos = makeRepos(makeExercise({ ghost: true, realId: 42 }));
    repos.cases.updateVisibilityForExercise = vi.fn().mockResolvedValue(3);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    const result = await service.setVisibilityForAll(1, STAFF, { showInput: true, showUserOutput: false });

    expect(repos.cases.updateVisibilityForExercise).toHaveBeenCalledWith(42, {
      showInput: true,
      showUserOutput: false,
    });
    expect(result).toEqual({ count: 3 });
  });
});

describe("ExerciseCaseService.removeAllCases", () => {
  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.removeAllCases(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("deletes every case row and best-effort cleans up their S3 objects", async () => {
    const repos = makeRepos();
    repos.cases.listForExercise = vi.fn().mockResolvedValue([CASE_RECORD, { ...CASE_RECORD, id: 11 }]);
    repos.cases.deleteAllForExercise = vi.fn().mockResolvedValue(2);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    const result = await service.removeAllCases(1, STAFF);

    expect(repos.cases.deleteAllForExercise).toHaveBeenCalledWith(1);
    expect(repos.storage.deleteCase).toHaveBeenCalledWith(10);
    expect(repos.storage.deleteCase).toHaveBeenCalledWith(11);
    expect(result).toEqual({ count: 2 });
  });
});

describe("ExerciseCaseService.buildCasesZip", () => {
  it("throws NotFoundError for a missing exercise", async () => {
    const repos = makeRepos(null);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.buildCasesZip(1, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a requester who is neither staff nor enrolled", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    repos.enrollments.isEnrolled = vi.fn().mockResolvedValue(false);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    await expect(service.buildCasesZip(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("includes every case's input/output for staff, regardless of visibility flags", async () => {
    const repos = makeRepos();
    repos.cases.listForExercise = vi
      .fn()
      .mockResolvedValue([CASE_RECORD, { ...CASE_RECORD, id: 11, showInput: false, showExpectedOutput: false }]);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    const { filename, archive } = await service.buildCasesZip(1, STAFF);
    const buffer = await drain(archive);

    expect(filename).toContain("Casos de Teste");
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    expect(repos.storage.getInput).toHaveBeenCalledWith(10);
    expect(repos.storage.getInput).toHaveBeenCalledWith(11);
    expect(repos.storage.getOutput).toHaveBeenCalledTimes(2);
  });

  it("only includes a case's input/output for a student when the visibility flag allows it", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    repos.enrollments.isEnrolled = vi.fn().mockResolvedValue(true);
    repos.cases.listForExercise = vi.fn().mockResolvedValue([
      { ...CASE_RECORD, id: 10, showInput: true, showExpectedOutput: false },
      { ...CASE_RECORD, id: 11, showInput: false, showExpectedOutput: false },
    ]);
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    const { archive } = await service.buildCasesZip(1, STUDENT);
    await drain(archive);

    expect(repos.storage.getInput).toHaveBeenCalledTimes(1);
    expect(repos.storage.getInput).toHaveBeenCalledWith(10);
    expect(repos.storage.getOutput).not.toHaveBeenCalled();
  });

  it("redirects a ghost exercise's zip to the real exercise's cases", async () => {
    const repos = makeRepos(makeExercise({ ghost: true, realId: 42 }));
    const service = new ExerciseCaseService(repos.exercises, repos.enrollments, repos.cases, repos.storage);

    const { archive } = await service.buildCasesZip(1, STAFF);
    await drain(archive);

    expect(repos.cases.listForExercise).toHaveBeenCalledWith(42);
  });
});
