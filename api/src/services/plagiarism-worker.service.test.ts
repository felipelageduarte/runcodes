import { describe, it, expect, vi } from "vitest";
import { PlagiarismWorkerService } from "./plagiarism-worker.service.js";
import type { CommitRepository, CommitRecord } from "../repositories/commit.repository.js";
import type { StorageRepository } from "../repositories/storage.repository.js";
import type { PlagiarismRunRepository, PlagiarismRunRecord } from "../repositories/plagiarism-run.repository.js";
import type { PlagiarismProvider } from "../repositories/plagiarism-provider.js";

function makeCommit(overrides: Partial<CommitRecord> = {}): CommitRecord {
  return {
    id: 1,
    userEmail: "a@x.com",
    exerciseId: 1,
    commitTime: new Date(),
    status: 5,
    hash: "h",
    corrects: 1,
    score: "10",
    compiled: true,
    compiledMessage: null,
    awsKey: "1/key-sol.py",
    ip: null,
    ...overrides,
  };
}

const RUN: PlagiarismRunRecord = {
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

function makeDeps(overrides: { run?: PlagiarismRunRecord | null; commits?: CommitRecord[] } = {}) {
  const runs: PlagiarismRunRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue("run" in overrides ? overrides.run : RUN),
    listForExercise: vi.fn(),
    markRunning: vi.fn(),
    markCompleted: vi.fn(),
    markFailed: vi.fn(),
  };
  const commits: CommitRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    listForUserOnExercise: vi.fn(),
    listLatestPerStudentForExercise: vi
      .fn()
      .mockResolvedValue(overrides.commits ?? [makeCommit({ userEmail: "a@x.com" }), makeCommit({ userEmail: "b@x.com" })]),
  };
  const storage: StorageRepository = {
    putCommitFile: vi.fn(),
    getCommitFile: vi.fn().mockResolvedValue(new TextEncoder().encode('print("x")')),
  };
  const dolos: PlagiarismProvider = {
    name: "dolos",
    compare: vi.fn().mockResolvedValue({ pairs: [{ studentA: "a@x.com", studentB: "b@x.com", similarity: 0.9 }] }),
  };
  const providers: Record<string, PlagiarismProvider> = { dolos };
  return { runs, commits, storage, providers, dolos };
}

describe("PlagiarismWorkerService.processRun", () => {
  it("does nothing if the run row no longer exists", async () => {
    const deps = makeDeps({ run: null });
    const service = new PlagiarismWorkerService(deps.runs, deps.commits, deps.storage, deps.providers);

    await service.processRun(999);

    expect(deps.runs.markRunning).not.toHaveBeenCalled();
  });

  it("marks running, then completed with the provider's result", async () => {
    const deps = makeDeps();
    const service = new PlagiarismWorkerService(deps.runs, deps.commits, deps.storage, deps.providers);

    await service.processRun(1);

    expect(deps.runs.markRunning).toHaveBeenCalledWith(1);
    expect(deps.runs.markCompleted).toHaveBeenCalledWith(1, [
      { studentA: "a@x.com", studentB: "b@x.com", similarity: 0.9 },
    ]);
  });

  it("downloads each student's latest commit content and passes it to the provider", async () => {
    const deps = makeDeps();
    const service = new PlagiarismWorkerService(deps.runs, deps.commits, deps.storage, deps.providers);

    await service.processRun(1);

    expect(deps.storage.getCommitFile).toHaveBeenCalledTimes(2);
    expect(deps.dolos.compare).toHaveBeenCalledWith([
      expect.objectContaining({ studentEmail: "a@x.com", filename: "key-sol.py", content: 'print("x")' }),
      expect.objectContaining({ studentEmail: "b@x.com", filename: "key-sol.py", content: 'print("x")' }),
    ]);
  });

  it("completes with an empty result when fewer than 2 students have submitted", async () => {
    const deps = makeDeps({ commits: [makeCommit()] });
    const service = new PlagiarismWorkerService(deps.runs, deps.commits, deps.storage, deps.providers);

    await service.processRun(1);

    expect(deps.runs.markCompleted).toHaveBeenCalledWith(1, []);
    expect(deps.dolos.compare).not.toHaveBeenCalled();
  });

  it("marks failed with the error message when the provider throws", async () => {
    const deps = makeDeps();
    deps.dolos.compare = vi.fn().mockRejectedValue(new Error("jar not found"));
    const service = new PlagiarismWorkerService(deps.runs, deps.commits, deps.storage, deps.providers);

    await service.processRun(1);

    expect(deps.runs.markFailed).toHaveBeenCalledWith(1, "jar not found");
  });

  it("marks failed for an unregistered provider", async () => {
    const deps = makeDeps();
    deps.providers = {}; // no "dolos" registered
    const service = new PlagiarismWorkerService(deps.runs, deps.commits, deps.storage, deps.providers);

    await service.processRun(1);

    expect(deps.runs.markFailed).toHaveBeenCalledWith(1, expect.stringContaining("dolos"));
  });
});
