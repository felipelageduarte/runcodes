import { describe, it, expect, vi } from "vitest";
import { CommitService } from "./commit.service.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../domain/errors.js";
import { CommitStatus } from "../lib/constants.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { CommitRepository, CommitRecord } from "../repositories/commit.repository.js";
import type { StorageRepository } from "../repositories/storage.repository.js";

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
    awsKey: "key",
    ip: null,
    ...overrides,
  };
}

function makeRepos(exercise: ExerciseRecord | null) {
  const exercises: ExerciseRepository = {
    findById: vi.fn().mockResolvedValue(exercise),
    list: vi.fn(),
    listVisible: vi.fn(),
    countCases: vi.fn(),
    findAllowedExtensions: vi.fn().mockResolvedValue([]),
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
  };
  const commits: CommitRepository = {
    create: vi.fn().mockImplementation((input) => Promise.resolve(makeCommitRecord({ ...input, id: 1 }))),
    findById: vi.fn(),
    listForUserOnExercise: vi.fn().mockResolvedValue([]),
  };
  const storage: StorageRepository = {
    putCommitFile: vi.fn().mockResolvedValue(undefined),
    getCommitFile: vi.fn(),
  };
  return { exercises, enrollments, commits, storage };
}

function buildService(repos: ReturnType<typeof makeRepos>) {
  return new CommitService(repos.exercises, repos.enrollments, repos.commits, repos.storage);
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
