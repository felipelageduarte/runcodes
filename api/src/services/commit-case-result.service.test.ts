import { describe, it, expect, vi } from "vitest";
import { CommitCaseResultService } from "./commit-case-result.service.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { CommitRepository, CommitRecord } from "../repositories/commit.repository.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { CommitCaseResultRepository, CommitCaseResultRecord } from "../repositories/commit-case-result.repository.js";
import type { CaseStorageRepository } from "../repositories/case-storage.repository.js";
import { UserType } from "../lib/constants.js";

const COMMIT: CommitRecord = {
  id: 1,
  userEmail: "student@x.com",
  exerciseId: 1,
  commitTime: new Date(),
  status: 5,
  hash: "h",
  corrects: 1,
  score: "10",
  compiled: true,
  compiledMessage: null,
  awsKey: "key",
  ip: null,
};

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
};

const CASE_RESULT: CommitCaseResultRecord = {
  id: 1,
  exerciseCaseId: 10,
  cputime: "0.5",
  memused: 1024,
  outputType: 1,
  status: 5,
  statusMessage: "OK",
  error: null,
  output: "actual output",
  showInput: false,
  showExpectedOutput: false,
  showUserOutput: false,
};

function makeRepos(overrides: { commit?: CommitRecord | null; isStaff?: boolean } = {}) {
  const commits: CommitRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue("commit" in overrides ? overrides.commit : COMMIT),
    listForUserOnExercise: vi.fn(),
    listLatestPerStudentForExercise: vi.fn(),
  };
  const exercises: ExerciseRepository = {
    findById: vi.fn().mockResolvedValue(EXERCISE),
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
    isStaff: vi.fn().mockResolvedValue(overrides.isStaff ?? false),
    findOne: vi.fn(),
    listForUser: vi.fn(),
    listRecordsForUser: vi.fn(),
    listStaffForOfferings: vi.fn(),
    create: vi.fn(),
    setRole: vi.fn(),
    ban: vi.fn(),
    listStudentsForOffering: vi.fn(),
  };
  const results: CommitCaseResultRepository = {
    listForCommit: vi.fn().mockResolvedValue([CASE_RESULT]),
  };
  const caseStorage: CaseStorageRepository = {
    putInput: vi.fn(),
    putOutput: vi.fn(),
    getInput: vi.fn().mockResolvedValue("expected input"),
    getOutput: vi.fn().mockResolvedValue("expected output"),
    deleteCase: vi.fn(),
  };
  return { commits, exercises, enrollments, results, caseStorage };
}

function buildService(repos: ReturnType<typeof makeRepos>) {
  return new CommitCaseResultService(repos.commits, repos.exercises, repos.enrollments, repos.results, repos.caseStorage);
}

const OWNER = { email: "student@x.com", type: 0 };
const OTHER_STUDENT = { email: "other@x.com", type: 0 };
const ADMIN = { email: "admin@x.com", type: UserType.ADMIN };

describe("CommitCaseResultService.listForCommit", () => {
  it("throws NotFoundError for a missing commit", async () => {
    const repos = makeRepos({ commit: null });
    const service = buildService(repos);

    await expect(service.listForCommit(1, OWNER)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a different student who isn't staff", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.listForCommit(1, OTHER_STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("allows the commit's owner", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await expect(service.listForCommit(1, OWNER)).resolves.toHaveLength(1);
  });

  it("allows an admin", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await expect(service.listForCommit(1, ADMIN)).resolves.toHaveLength(1);
  });

  it("hides output and expected input/output from a non-owner, non-staff-visible case", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const [result] = await service.listForCommit(1, OWNER);

    expect(result.output).toBeNull();
    expect(result.expectedInput).toBeNull();
    expect(result.expectedOutput).toBeNull();
    expect(repos.caseStorage.getInput).not.toHaveBeenCalled();
    expect(repos.caseStorage.getOutput).not.toHaveBeenCalled();
  });

  it("shows everything to staff regardless of the case's show_* flags", async () => {
    const repos = makeRepos({ isStaff: true });
    repos.commits.findById = vi.fn().mockResolvedValue({ ...COMMIT, userEmail: "someone-else@x.com" });
    const service = buildService(repos);

    const [result] = await service.listForCommit(1, { email: "prof@x.com", type: 0 });

    expect(result.output).toBe("actual output");
    expect(result.expectedInput).toBe("expected input");
    expect(result.expectedOutput).toBe("expected output");
  });

  it("respects per-field show flags for the owner", async () => {
    const repos = makeRepos();
    repos.results.listForCommit = vi
      .fn()
      .mockResolvedValue([{ ...CASE_RESULT, showUserOutput: true, showInput: false, showExpectedOutput: true }]);
    const service = buildService(repos);

    const [result] = await service.listForCommit(1, OWNER);

    expect(result.output).toBe("actual output");
    expect(result.expectedInput).toBeNull();
    expect(result.expectedOutput).toBe("expected output");
  });
});
