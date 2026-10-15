import { describe, it, expect, vi } from "vitest";
import { CommitService } from "./commit.service.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../domain/errors.js";
import { CommitStatus } from "../lib/constants.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { CommitRepository, CommitRecord } from "../repositories/commit.repository.js";
import type { StorageRepository } from "../repositories/storage.repository.js";
import type { CommitCaseResultRepository } from "../repositories/commit-case-result.repository.js";
import type { ExerciseCaseRepository } from "../repositories/exercise-case.repository.js";

function makeExercise(overrides: Partial<ExerciseRecord> = {}): ExerciseRecord {
  return {
    id: 1,
    offeringId: 1,
    title: "Ex",
    description: null,
    deadline: new Date(Date.now() + 86_400_000),
    type: 0, // compilable
    openDate: new Date(Date.now() - 1000),
    showBeforeOpening: false,
    removed: false,
    ghost: false,
    realId: null,
    markdown: false,
    ...overrides,
  };
}

function makeCommitRecord(overrides: Partial<CommitRecord> = {}): CommitRecord {
  return {
    id: 1,
    userEmail: "s@x.com",
    exerciseId: 1,
    commitTime: new Date(),
    status: CommitStatus.IN_QUEUE,
    hash: "h",
    corrects: 0,
    score: "0",
    compiled: null,
    compiledMessage: null,
    compiledSignal: null,
    awsKey: "key",
    ip: null,
    ...overrides,
  };
}

function makeRepos(exercise: ExerciseRecord | null) {
  const exercises: ExerciseRepository = {
    findById: vi.fn().mockResolvedValue(exercise),
    findByIds: vi.fn().mockResolvedValue([]),
    findGhosts: vi.fn().mockResolvedValue([]),
    list: vi.fn(),
    listVisible: vi.fn(),
    countCases: vi.fn(),
    findAllowedExtensions: vi.fn().mockResolvedValue([]),
    listAllowedFiles: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    setAllowedFiles: vi.fn(),
  };
  const enrollments: EnrollmentRepository = {
    isEnrolled: vi.fn().mockResolvedValue(true),
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
  const commits: CommitRepository = {
    create: vi.fn().mockImplementation((input) => Promise.resolve(makeCommitRecord({ ...input, id: 1 }))),
    findById: vi.fn(),
    listForUserOnExercise: vi.fn().mockResolvedValue([]),
    listLatestPerStudentForExercise: vi.fn().mockResolvedValue([]),
    listLatestForUserAcrossExercises: vi.fn().mockResolvedValue([]),
    updateScore: vi.fn().mockImplementation((id, patch) => Promise.resolve(makeCommitRecord({ id, ...patch }))),
    resetToQueue: vi.fn().mockImplementation((id) =>
      Promise.resolve(makeCommitRecord({ id, status: CommitStatus.IN_QUEUE, compiledMessage: "", compiled: false, corrects: 0, score: "0" })),
    ),
    resetManyToQueue: vi.fn().mockResolvedValue(undefined),
  };
  const storage: StorageRepository = {
    putCommitFile: vi.fn().mockResolvedValue(undefined),
    getCommitFile: vi.fn(),
  };
  const caseResults: CommitCaseResultRepository = {
    listForCommit: vi.fn().mockResolvedValue([]),
    deleteForCommits: vi.fn().mockResolvedValue(undefined),
  };
  const exerciseCases: ExerciseCaseRepository = {
    findById: vi.fn(),
    listForExercise: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateVisibilityForExercise: vi.fn(),
    delete: vi.fn(),
    deleteAllForExercise: vi.fn(),
    maxLastUpdate: vi.fn().mockResolvedValue(null),
  };
  return { exercises, enrollments, commits, storage, caseResults, exerciseCases };
}

function buildService(repos: ReturnType<typeof makeRepos>) {
  return new CommitService(
    repos.exercises,
    repos.enrollments,
    repos.commits,
    repos.storage,
    repos.caseResults,
    repos.exerciseCases,
  );
}

const STUDENT = { email: "s@x.com", type: 0 };
const file = (name: string, size: number) => ({ originalname: name, buffer: Buffer.alloc(size) });

describe("CommitService.submit", () => {
  it("throws NotFoundError for a missing/removed exercise", async () => {
    const repos = makeRepos(null);
    const service = buildService(repos);

    await expect(
      service.submit({ exerciseId: 1, requester: STUDENT, ip: null, file: file("a.py", 10) }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws ForbiddenError when the requester has no enrollment at all", async () => {
    const repos = makeRepos(makeExercise());
    repos.enrollments.isEnrolled = vi.fn().mockResolvedValue(false);
    const service = buildService(repos);

    await expect(
      service.submit({ exerciseId: 1, requester: STUDENT, ip: null, file: file("a.py", 10) }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("throws ValidationError(exercise_closed) for a closed exercise submitted by a student", async () => {
    const repos = makeRepos(makeExercise({ deadline: new Date(Date.now() - 1000) }));
    const service = buildService(repos);

    const promise = service.submit({
      exerciseId: 1,
      requester: STUDENT,
      ip: null,
      file: file("a.py", 10),
    });
    await expect(promise).rejects.toThrow(ValidationError);
    await expect(promise).rejects.toMatchObject({ code: "exercise_closed" });
  });

  it("lets staff submit to a closed exercise", async () => {
    const repos = makeRepos(makeExercise({ deadline: new Date(Date.now() - 1000) }));
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    const commit = await service.submit({
      exerciseId: 1,
      requester: { email: "p@x.com", type: 0 },
      ip: null,
      file: file("a.py", 10),
    });
    expect(commit).toBeDefined();
  });

  it("rejects a disallowed file extension", async () => {
    const repos = makeRepos(makeExercise());
    repos.exercises.findAllowedExtensions = vi.fn().mockResolvedValue(["py", "c"]);
    const service = buildService(repos);

    const promise = service.submit({
      exerciseId: 1,
      requester: STUDENT,
      ip: null,
      file: file("a.txt", 10),
    });
    await expect(promise).rejects.toMatchObject({ code: "file_type_not_allowed" });
  });

  it("allows any extension when the exercise has no allow-list configured", async () => {
    const repos = makeRepos(makeExercise());
    repos.exercises.findAllowedExtensions = vi.fn().mockResolvedValue([]);
    const service = buildService(repos);

    await expect(
      service.submit({ exerciseId: 1, requester: STUDENT, ip: null, file: file("a.anything", 10) }),
    ).resolves.toBeDefined();
  });

  it("looks up allowed extensions by the ghost exercise's real_id", async () => {
    const repos = makeRepos(makeExercise({ ghost: true, realId: 77 }));
    const service = buildService(repos);

    await service.submit({ exerciseId: 1, requester: STUDENT, ip: null, file: file("a.py", 10) });

    expect(repos.exercises.findAllowedExtensions).toHaveBeenCalledWith(77);
  });

  it("rejects a compilable submission over 1MB", async () => {
    const repos = makeRepos(makeExercise({ type: 0 }));
    const service = buildService(repos);

    const promise = service.submit({
      exerciseId: 1,
      requester: STUDENT,
      ip: null,
      file: file("a.py", 1_000_001),
    });
    await expect(promise).rejects.toMatchObject({ code: "file_too_large" });
  });

  it("allows a non-compilable submission up to 5MB", async () => {
    const repos = makeRepos(makeExercise({ type: 1 }));
    const service = buildService(repos);

    await expect(
      service.submit({ exerciseId: 1, requester: STUDENT, ip: null, file: file("a.pdf", 4_000_000) }),
    ).resolves.toBeDefined();
  });

  it("queues a compilable submission (status=IN_QUEUE) and uploads to storage", async () => {
    const repos = makeRepos(makeExercise({ type: 0 }));
    const service = buildService(repos);

    const commit = await service.submit({
      exerciseId: 1,
      requester: STUDENT,
      ip: "1.2.3.4",
      file: file("a.py", 10),
    });

    expect(commit.status).toBe(CommitStatus.IN_QUEUE);
    expect(repos.storage.putCommitFile).toHaveBeenCalledTimes(1);
    expect(repos.commits.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: CommitStatus.IN_QUEUE, userEmail: "s@x.com", exerciseId: 1 }),
    );
  });

  it("marks a non-compilable submission as SUBMITTED, awaiting manual grading", async () => {
    const repos = makeRepos(makeExercise({ type: 1 }));
    const service = buildService(repos);

    const commit = await service.submit({
      exerciseId: 1,
      requester: STUDENT,
      ip: null,
      file: file("a.pdf", 10),
    });

    expect(commit.status).toBe(CommitStatus.SUBMITTED);
  });
});

describe("CommitService.getById", () => {
  it("throws NotFoundError for a missing commit", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(service.getById(1, STUDENT)).rejects.toThrow(NotFoundError);
  });

  it("allows the commit's owner", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(makeCommitRecord({ userEmail: "s@x.com" }));
    const service = buildService(repos);

    await expect(service.getById(1, STUDENT)).resolves.toBeDefined();
  });

  it("rejects a different student who isn't staff", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(makeCommitRecord({ userEmail: "other@x.com" }));
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = buildService(repos);

    await expect(service.getById(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("allows staff of the owning offering to view another student's commit", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(makeCommitRecord({ userEmail: "other@x.com" }));
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    await expect(service.getById(1, { email: "prof@x.com", type: 0 })).resolves.toBeDefined();
  });
});

describe("CommitService.getContent", () => {
  it("throws NotFoundError for a missing commit", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(service.getContent(1, STUDENT)).rejects.toThrow(NotFoundError);
  });

  it("rejects a different student who isn't staff", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(makeCommitRecord({ userEmail: "other@x.com" }));
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = buildService(repos);

    await expect(service.getContent(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when the commit has no stored file yet", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(
      makeCommitRecord({ userEmail: "s@x.com", awsKey: null }),
    );
    const service = buildService(repos);

    await expect(service.getContent(1, STUDENT)).rejects.toThrow(NotFoundError);
  });

  it("fetches the file from storage and recovers the original filename from the key", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(
      makeCommitRecord({
        userEmail: "s@x.com",
        awsKey: "1/2f1c9b9a-7b3d-4e2a-9c4e-1a2b3c4d5e6f-solution.py",
      }),
    );
    repos.storage.getCommitFile = vi.fn().mockResolvedValue(new Uint8Array(Buffer.from('print("hi")')));
    const service = buildService(repos);

    const result = await service.getContent(1, STUDENT);

    expect(repos.storage.getCommitFile).toHaveBeenCalledWith(
      "1/2f1c9b9a-7b3d-4e2a-9c4e-1a2b3c4d5e6f-solution.py",
    );
    expect(result.filename).toBe("solution.py");
    expect(Buffer.from(result.content).toString()).toBe('print("hi")');
  });

  it("allows staff of the owning offering to read another student's commit content", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(
      makeCommitRecord({ userEmail: "other@x.com", awsKey: "1/uuid-x.py" }),
    );
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    repos.storage.getCommitFile = vi.fn().mockResolvedValue(new Uint8Array());
    const service = buildService(repos);

    await expect(service.getContent(1, { email: "prof@x.com", type: 0 })).resolves.toBeDefined();
  });
});

const PROFESSOR = { email: "prof@x.com", type: 0 };

describe("CommitService.editScore", () => {
  it("throws NotFoundError for a missing commit", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(service.editScore(1, PROFESSOR, { score: "8", status: 5 })).rejects.toThrow(NotFoundError);
  });

  it("rejects a non-staff, non-admin requester (including the commit's own owner)", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(makeCommitRecord());
    const service = buildService(repos);

    await expect(service.editScore(1, STUDENT, { score: "8", status: 5 })).rejects.toThrow(ForbiddenError);
    expect(repos.commits.updateScore).not.toHaveBeenCalled();
  });

  it("lets staff of the owning offering overwrite score/status", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(makeCommitRecord());
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    await service.editScore(1, PROFESSOR, { score: "8", status: 5 });

    expect(repos.commits.updateScore).toHaveBeenCalledWith(1, { score: "8", status: 5 });
  });
});

describe("CommitService.recompile", () => {
  it("rejects a non-compilable exercise", async () => {
    const repos = makeRepos(makeExercise({ type: 1 }));
    repos.commits.findById = vi.fn().mockResolvedValue(makeCommitRecord());
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    const promise = service.recompile(1, PROFESSOR);
    await expect(promise).rejects.toThrow(ValidationError);
    await expect(promise).rejects.toMatchObject({ code: "exercise_not_compilable" });
  });

  it("rejects a non-admin while the commit is still being processed", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(makeCommitRecord({ status: CommitStatus.COMPILING }));
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    const promise = service.recompile(1, PROFESSOR);
    await expect(promise).rejects.toThrow(ValidationError);
    await expect(promise).rejects.toMatchObject({ code: "commit_in_progress" });
  });

  it("lets an admin recompile even a commit still in progress", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(makeCommitRecord({ status: CommitStatus.COMPILING }));
    const service = buildService(repos);

    await service.recompile(1, { email: "admin@x.com", type: 3 });

    expect(repos.caseResults.deleteForCommits).toHaveBeenCalledWith([1]);
    expect(repos.commits.resetToQueue).toHaveBeenCalledWith(1);
  });

  it("deletes stale case results and resets the commit to IN_QUEUE for a completed commit", async () => {
    const repos = makeRepos(makeExercise());
    repos.commits.findById = vi.fn().mockResolvedValue(makeCommitRecord({ status: CommitStatus.COMPLETED }));
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    const result = await service.recompile(1, PROFESSOR);

    expect(result.status).toBe(CommitStatus.IN_QUEUE);
  });
});

describe("CommitService.recompileAll", () => {
  it("rejects a non-compilable exercise", async () => {
    const repos = makeRepos(makeExercise({ type: 1 }));
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    await expect(service.recompileAll(1, PROFESSOR)).rejects.toMatchObject({ code: "exercise_not_compilable" });
  });

  it("rejects non-admin when any latest-per-student commit is still processing", async () => {
    const repos = makeRepos(makeExercise());
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    repos.commits.listLatestPerStudentForExercise = vi
      .fn()
      .mockResolvedValue([makeCommitRecord({ id: 1, status: CommitStatus.COMPLETED }), makeCommitRecord({ id: 2, status: CommitStatus.COMPILING })]);
    const service = buildService(repos);

    await expect(service.recompileAll(1, PROFESSOR)).rejects.toMatchObject({ code: "commits_in_progress" });
  });

  it("resets every latest-per-student commit to IN_QUEUE and returns the count", async () => {
    const repos = makeRepos(makeExercise());
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    repos.commits.listLatestPerStudentForExercise = vi
      .fn()
      .mockResolvedValue([
        makeCommitRecord({ id: 1, status: CommitStatus.COMPLETED }),
        makeCommitRecord({ id: 2, status: CommitStatus.COMPLETED }),
      ]);
    const service = buildService(repos);

    const result = await service.recompileAll(1, PROFESSOR);

    expect(result).toEqual({ count: 2 });
    expect(repos.caseResults.deleteForCommits).toHaveBeenCalledWith([1, 2]);
    expect(repos.commits.resetManyToQueue).toHaveBeenCalledWith([1, 2]);
  });
});

describe("CommitService.isUnsafe", () => {
  it("is false when the exercise has no cases yet", async () => {
    const repos = makeRepos(makeExercise());
    const service = buildService(repos);

    await expect(service.isUnsafe({ exerciseId: 1, commitTime: new Date() })).resolves.toBe(false);
  });

  it("is true when the commit predates the most recent case update", async () => {
    const repos = makeRepos(makeExercise());
    repos.exerciseCases.maxLastUpdate = vi.fn().mockResolvedValue(new Date("2026-01-02"));
    const service = buildService(repos);

    await expect(
      service.isUnsafe({ exerciseId: 1, commitTime: new Date("2026-01-01") }),
    ).resolves.toBe(true);
  });

  it("is false when the commit is newer than the last case update", async () => {
    const repos = makeRepos(makeExercise());
    repos.exerciseCases.maxLastUpdate = vi.fn().mockResolvedValue(new Date("2026-01-01"));
    const service = buildService(repos);

    await expect(
      service.isUnsafe({ exerciseId: 1, commitTime: new Date("2026-01-02") }),
    ).resolves.toBe(false);
  });
});
