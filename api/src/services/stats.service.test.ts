import { describe, it, expect, vi } from "vitest";
import { StatsService } from "./stats.service.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { ExerciseCaseRepository, ExerciseCaseRecord } from "../repositories/exercise-case.repository.js";
import type { OfferingRepository, OfferingRecord } from "../repositories/offering.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { CommitRepository, CommitRecord } from "../repositories/commit.repository.js";
import type { CommitCaseResultRepository, CommitCaseResultRecord } from "../repositories/commit-case-result.repository.js";
import type { UserRepository, UserRecord } from "../repositories/user.repository.js";
import { UserType } from "../lib/constants.js";

const EXERCISE: ExerciseRecord = {
  id: 10,
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

const OFFERING: OfferingRecord = {
  id: 1,
  courseId: 1,
  year: 2026,
  term: 1,
  classroom: "A",
  endDate: new Date("2099-01-01"),
  enrollmentCode: null,
  maxStudents: 0,
  maxExercises: 0,
};

function makeCase(overrides: Partial<ExerciseCaseRecord> = {}): ExerciseCaseRecord {
  return {
    id: 1,
    exerciseId: 10,
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
    ...overrides,
  };
}

function makeCommit(overrides: Partial<CommitRecord> = {}): CommitRecord {
  return {
    id: 1,
    userEmail: "alice@x.com",
    exerciseId: 10,
    commitTime: new Date(),
    status: 5,
    hash: "h",
    corrects: 1,
    score: "10",
    compiled: true,
    compiledMessage: null,
    awsKey: "key",
    ip: null,
    ...overrides,
  };
}

function makeCaseResult(overrides: Partial<CommitCaseResultRecord> = {}): CommitCaseResultRecord {
  return {
    id: 1,
    exerciseCaseId: 1,
    cputime: "0.1",
    memused: 100,
    outputType: 0,
    status: 1,
    statusMessage: null,
    error: null,
    output: "",
    showInput: null,
    showExpectedOutput: null,
    showUserOutput: null,
    ...overrides,
  };
}

function makeRepos(
  overrides: { exercise?: ExerciseRecord | null; offering?: OfferingRecord | null; isStaff?: boolean } = {},
) {
  const exercises: ExerciseRepository = {
    findById: vi.fn().mockResolvedValue("exercise" in overrides ? overrides.exercise : EXERCISE),
    list: vi.fn(),
    listVisible: vi.fn().mockResolvedValue([EXERCISE]),
    countCases: vi.fn(),
    findAllowedExtensions: vi.fn(),
    listAllowedFiles: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    setAllowedFiles: vi.fn(),
  };
  const exerciseCases: ExerciseCaseRepository = {
    findById: vi.fn(),
    listForExercise: vi.fn().mockResolvedValue([makeCase({ id: 1 }), makeCase({ id: 2 })]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const offerings: OfferingRepository = {
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue("offering" in overrides ? overrides.offering : OFFERING),
    findByIds: vi.fn(),
    findByEnrollmentCode: vi.fn(),
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
    listStudentsForOffering: vi
      .fn()
      .mockResolvedValue([{ email: "alice@x.com", name: "Alice", identifier: "1" }]),
  };
  const commits: CommitRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    listForUserOnExercise: vi.fn().mockResolvedValue([makeCommit()]),
    listLatestPerStudentForExercise: vi.fn().mockResolvedValue([makeCommit()]),
    listLatestForUserAcrossExercises: vi.fn().mockResolvedValue([]),
  };
  const commitCaseResults: CommitCaseResultRepository = {
    listForCommit: vi.fn().mockResolvedValue([makeCaseResult({ exerciseCaseId: 1, status: 1 })]),
  };
  const users: UserRepository = {
    findByEmail: vi.fn().mockResolvedValue({
      email: "alice@x.com",
      name: "Alice",
      password: "",
      type: 0,
      universityId: 1,
      confirmed: true,
      identifier: "1",
    } satisfies UserRecord),
    updatePassword: vi.fn(),
    existsByEmail: vi.fn(),
    create: vi.fn(),
    findConfirmationState: vi.fn(),
    confirm: vi.fn(),
    setConfirmationToken: vi.fn(),
    setResetToken: vi.fn(),
    findResetState: vi.fn(),
    resetPassword: vi.fn(),
    listForAdmin: vi.fn(),
    updateByAdmin: vi.fn(),
  };
  return { exercises, exerciseCases, offerings, enrollments, commits, commitCaseResults, users };
}

function buildService(repos: ReturnType<typeof makeRepos>) {
  return new StatsService(
    repos.exercises,
    repos.exerciseCases,
    repos.offerings,
    repos.enrollments,
    repos.commits,
    repos.commitCaseResults,
    repos.users,
  );
}

const STAFF = { email: "prof@x.com", type: 0 };
const STUDENT = { email: "alice@x.com", type: 0 };
const ADMIN = { email: "admin@x.com", type: UserType.ADMIN };

describe("StatsService.getExerciseCaseStats", () => {
  it("throws NotFoundError for a missing exercise", async () => {
    const repos = makeRepos({ exercise: null });
    const service = buildService(repos);

    await expect(service.getExerciseCaseStats(10, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff, non-admin requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.getExerciseCaseStats(10, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("computes the correct-percentage per case from the latest commit per student", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const result = await service.getExerciseCaseStats(10, STAFF);

    expect(result.caseLabels).toEqual(["Case 1", "Case 2"]);
    expect(result.correctPercentage).toEqual([100, 0]); // case 1 correct for the one submitter, case 2 untouched
  });

  it("reads cases from the real exercise for a ghost clone", async () => {
    const repos = makeRepos({ exercise: { ...EXERCISE, ghost: true, realId: 99 } });
    const service = buildService(repos);

    await service.getExerciseCaseStats(10, STAFF);

    expect(repos.exerciseCases.listForExercise).toHaveBeenCalledWith(99);
  });

  it("returns 0% for every case when nobody has submitted", async () => {
    const repos = makeRepos();
    repos.commits.listLatestPerStudentForExercise = vi.fn().mockResolvedValue([]);
    const service = buildService(repos);

    const result = await service.getExerciseCaseStats(10, STAFF);

    expect(result.correctPercentage).toEqual([0, 0]);
  });
});

describe("StatsService.getParticipantCommits", () => {
  it("throws NotFoundError for a missing exercise", async () => {
    const repos = makeRepos({ exercise: null });
    const service = buildService(repos);

    await expect(service.getParticipantCommits(10, "alice@x.com", STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.getParticipantCommits(10, "alice@x.com", STUDENT)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("returns the student's commit history", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const result = await service.getParticipantCommits(10, "alice@x.com", STAFF);

    expect(result).toEqual([{ id: 1, commitTime: expect.any(Date), status: 5, corrects: 1, score: "10" }]);
    expect(repos.commits.listForUserOnExercise).toHaveBeenCalledWith(10, "alice@x.com");
  });
});

describe("StatsService.getOfferingStats", () => {
  it("throws NotFoundError for a missing offering", async () => {
    const repos = makeRepos({ offering: null });
    const service = buildService(repos);

    await expect(service.getOfferingStats(1, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff, non-admin requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.getOfferingStats(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("allows an admin without an enrollment check", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.getOfferingStats(1, ADMIN)).resolves.toBeDefined();
    expect(repos.enrollments.isStaff).not.toHaveBeenCalled();
  });

  it("computes the class average per exercise, without a participant overlay by default", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const result = await service.getOfferingStats(1, STAFF);

    expect(result.exerciseLabels).toEqual(["Ex"]);
    expect(result.classAverage).toEqual([10]);
    expect(result.participant).toBeUndefined();
  });

  it("overlays a participant's own scores when given a valid email", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const result = await service.getOfferingStats(1, STAFF, "alice@x.com");

    expect(result.participant).toEqual({ name: "Alice", scores: [10] });
  });

  it("silently drops an unknown participant email", async () => {
    const repos = makeRepos();
    repos.users.findByEmail = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    const result = await service.getOfferingStats(1, STAFF, "ghost@x.com");

    expect(result.participant).toBeUndefined();
  });
});

describe("StatsService.getOfferingInfographic", () => {
  it("throws NotFoundError for a missing offering", async () => {
    const repos = makeRepos({ offering: null });
    const service = buildService(repos);

    await expect(service.getOfferingInfographic(1, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff, non-admin requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.getOfferingInfographic(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("aggregates student count, percent-above-5, and average score", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const result = await service.getOfferingInfographic(1, STAFF);

    expect(result).toEqual({ studentCount: 1, gradesAbove5Percent: 100, gradesAverage: 10 });
  });

  it("returns zeroes when nobody has submitted anything", async () => {
    const repos = makeRepos();
    repos.commits.listLatestPerStudentForExercise = vi.fn().mockResolvedValue([]);
    const service = buildService(repos);

    const result = await service.getOfferingInfographic(1, STAFF);

    expect(result).toEqual({ studentCount: 1, gradesAbove5Percent: 0, gradesAverage: 0 });
  });
});
