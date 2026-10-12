import { describe, it, expect, vi } from "vitest";
import { PlagiarismService } from "./plagiarism.service.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../domain/errors.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { PlagiarismRunRepository, PlagiarismRunRecord } from "../repositories/plagiarism-run.repository.js";
import type { PlagiarismJobQueue } from "../repositories/plagiarism-job-queue.js";
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

const RUN_RECORD: PlagiarismRunRecord = {
  id: 1,
  exerciseId: 1,
  provider: "dolos",
  status: "queued",
  requestedBy: "prof@x.com",
  result: null,
  error: null,
  createdAt: new Date(),
  completedAt: null,
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
  const runs: PlagiarismRunRepository = {
    create: vi.fn().mockResolvedValue(RUN_RECORD),
    findById: vi.fn().mockResolvedValue(RUN_RECORD),
    listForExercise: vi.fn().mockResolvedValue([RUN_RECORD]),
    markRunning: vi.fn(),
    markCompleted: vi.fn(),
    markFailed: vi.fn(),
  };
  const queue: PlagiarismJobQueue = { enqueue: vi.fn().mockResolvedValue(undefined), close: vi.fn() };
  return { exercises, enrollments, runs, queue };
}

const STAFF = { email: "prof@x.com", type: 0 };
const STUDENT = { email: "student@x.com", type: 0 };
const ADMIN = { email: "admin@x.com", type: UserType.ADMIN };

describe("PlagiarismService.requestRun", () => {
  it("throws NotFoundError for a missing exercise", async () => {
    const repos = makeRepos(null);
    const service = new PlagiarismService(repos.exercises, repos.enrollments, repos.runs, repos.queue);

    await expect(service.requestRun(1, "dolos", STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a plain student", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new PlagiarismService(repos.exercises, repos.enrollments, repos.runs, repos.queue);

    await expect(service.requestRun(1, "dolos", STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("rejects an unknown provider", async () => {
    const repos = makeRepos();
    const service = new PlagiarismService(repos.exercises, repos.enrollments, repos.runs, repos.queue);

    // @ts-expect-error intentionally invalid provider
    await expect(service.requestRun(1, "moss", STAFF)).rejects.toThrow(ValidationError);
  });

  it("creates the run row and enqueues a job, for staff or admin", async () => {
    const repos = makeRepos();
    const service = new PlagiarismService(repos.exercises, repos.enrollments, repos.runs, repos.queue);

    const run = await service.requestRun(1, "dolos", ADMIN);

    expect(repos.runs.create).toHaveBeenCalledWith(1, "dolos", ADMIN.email);
    expect(repos.queue.enqueue).toHaveBeenCalledWith({ runId: RUN_RECORD.id });
    expect(run).toEqual(RUN_RECORD);
  });
});

describe("PlagiarismService.getRun", () => {
  it("throws NotFoundError for a missing run", async () => {
    const repos = makeRepos();
    repos.runs.findById = vi.fn().mockResolvedValue(null);
    const service = new PlagiarismService(repos.exercises, repos.enrollments, repos.runs, repos.queue);

    await expect(service.getRun(1, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a student who isn't staff", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new PlagiarismService(repos.exercises, repos.enrollments, repos.runs, repos.queue);

    await expect(service.getRun(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });
});

describe("PlagiarismService.listForExercise", () => {
  it("is forbidden for a plain student", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(false);
    const service = new PlagiarismService(repos.exercises, repos.enrollments, repos.runs, repos.queue);

    await expect(service.listForExercise(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("lists runs for staff", async () => {
    const repos = makeRepos();
    const service = new PlagiarismService(repos.exercises, repos.enrollments, repos.runs, repos.queue);

    await expect(service.listForExercise(1, STAFF)).resolves.toEqual([RUN_RECORD]);
  });
});
