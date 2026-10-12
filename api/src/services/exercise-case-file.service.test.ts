import { describe, it, expect, vi } from "vitest";
import { ExerciseCaseFileService } from "./exercise-case-file.service.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { ExerciseCaseRepository, ExerciseCaseRecord } from "../repositories/exercise-case.repository.js";
import type {
  ExerciseCaseFileRepository,
  ExerciseCaseFileRecord,
} from "../repositories/exercise-case-file.repository.js";
import type { CaseStorageRepository } from "../repositories/case-storage.repository.js";
import { UserType } from "../lib/constants.js";

const EXERCISE: ExerciseRecord = {
  id: 1,
  offeringId: 1,
  title: "Ex",
  description: null,
  deadline: new Date(),
  type: 0,
  openDate: new Date(),
  showBeforeOpening: false,
  removed: false,
  ghost: false,
  realId: null,
  markdown: false,
};

const EXERCISE_CASE: ExerciseCaseRecord = {
  id: 5,
  exerciseId: 1,
  outputType: 0,
  showInput: false,
  showExpectedOutput: false,
  showUserOutput: false,
  cputime: 1,
  maxmemsize: 1,
  stacksize: 1,
  fileSize: 1,
  absError: null,
  inputMd5: null,
  outputMd5: null,
};

const CASE_FILE: ExerciseCaseFileRecord = { id: 10, exerciseCaseId: 5, path: "data.txt" };

function makeRepos(
  overrides: { exerciseCase?: ExerciseCaseRecord | null; exercise?: ExerciseRecord | null; isStaff?: boolean } = {},
) {
  const exercises: ExerciseRepository = {
    findById: vi.fn().mockResolvedValue("exercise" in overrides ? overrides.exercise : EXERCISE),
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
    isEnrolled: vi.fn(),
    isStaff: vi.fn().mockResolvedValue(overrides.isStaff ?? true),
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
    findById: vi.fn().mockResolvedValue("exerciseCase" in overrides ? overrides.exerciseCase : EXERCISE_CASE),
    listForExercise: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const caseFiles: ExerciseCaseFileRepository = {
    listForCase: vi.fn().mockResolvedValue([CASE_FILE]),
    findById: vi.fn().mockResolvedValue(CASE_FILE),
    create: vi.fn().mockResolvedValue(CASE_FILE),
    delete: vi.fn().mockResolvedValue(true),
  };
  const storage: CaseStorageRepository = {
    putInput: vi.fn(),
    putOutput: vi.fn(),
    getInput: vi.fn(),
    getOutput: vi.fn(),
    putFile: vi.fn().mockResolvedValue(undefined),
    getFile: vi.fn().mockResolvedValue(new Uint8Array(Buffer.from("content"))),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    deleteCase: vi.fn(),
  };
  return { exercises, enrollments, cases, caseFiles, storage };
}

function buildService(repos: ReturnType<typeof makeRepos>) {
  return new ExerciseCaseFileService(repos.exercises, repos.enrollments, repos.cases, repos.caseFiles, repos.storage);
}

const STAFF = { email: "prof@x.com", type: 0 };
const STUDENT = { email: "student@x.com", type: 0 };
const ADMIN = { email: "admin@x.com", type: UserType.ADMIN };

describe("ExerciseCaseFileService.list", () => {
  it("throws NotFoundError for a missing case", async () => {
    const repos = makeRepos({ exerciseCase: null });
    const service = buildService(repos);

    await expect(service.list(5, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff, non-admin requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.list(5, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("allows an admin without an enrollment check", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.list(5, ADMIN)).resolves.toEqual([CASE_FILE]);
    expect(repos.enrollments.isStaff).not.toHaveBeenCalled();
  });

  it("lists the case's files for staff", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await expect(service.list(5, STAFF)).resolves.toEqual([CASE_FILE]);
  });
});

describe("ExerciseCaseFileService.upload", () => {
  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(
      service.upload(5, STUDENT, { filename: "data.txt", content: Buffer.from("x") }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("stores the file in S3 then creates the DB row", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const result = await service.upload(5, STAFF, { filename: "data.txt", content: Buffer.from("x") });

    expect(repos.storage.putFile).toHaveBeenCalledWith(5, "data.txt", Buffer.from("x"));
    expect(repos.caseFiles.create).toHaveBeenCalledWith(5, "data.txt");
    expect(result).toEqual(CASE_FILE);
  });

  it("rolls back the S3 object if the DB write fails", async () => {
    const repos = makeRepos();
    repos.caseFiles.create = vi.fn().mockRejectedValue(new Error("db down"));
    const service = buildService(repos);

    await expect(
      service.upload(5, STAFF, { filename: "data.txt", content: Buffer.from("x") }),
    ).rejects.toThrow("db down");
    expect(repos.storage.deleteFile).toHaveBeenCalledWith(5, "data.txt");
  });
});

describe("ExerciseCaseFileService.getContent", () => {
  it("throws NotFoundError for a missing case file", async () => {
    const repos = makeRepos();
    repos.caseFiles.findById = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(service.getContent(10, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.getContent(10, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("returns the filename and content fetched from S3", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const result = await service.getContent(10, STAFF);

    expect(repos.storage.getFile).toHaveBeenCalledWith(5, "data.txt");
    expect(result.filename).toBe("data.txt");
    expect(Buffer.from(result.content).toString()).toBe("content");
  });
});

describe("ExerciseCaseFileService.delete", () => {
  it("throws NotFoundError for a missing case file", async () => {
    const repos = makeRepos();
    repos.caseFiles.findById = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(service.delete(10, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.delete(10, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("deletes the DB row then the S3 object", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await service.delete(10, STAFF);

    expect(repos.caseFiles.delete).toHaveBeenCalledWith(10);
    expect(repos.storage.deleteFile).toHaveBeenCalledWith(5, "data.txt");
  });

  it("throws NotFoundError if the DB row was already gone", async () => {
    const repos = makeRepos();
    repos.caseFiles.delete = vi.fn().mockResolvedValue(false);
    const service = buildService(repos);

    await expect(service.delete(10, STAFF)).rejects.toThrow(NotFoundError);
  });
});
