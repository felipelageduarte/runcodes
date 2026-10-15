import { describe, it, expect, vi } from "vitest";
import { MarketplaceStatsService } from "./marketplace-stats.service.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { CommitRepository, CommitRecord } from "../repositories/commit.repository.js";

function makeExercise(overrides: Partial<ExerciseRecord> = {}): ExerciseRecord {
  return {
    id: 1,
    offeringId: 1,
    title: "Ex",
    description: null,
    deadline: new Date(),
    type: 0,
    openDate: null,
    showBeforeOpening: false,
    removed: false,
    ghost: false,
    realId: null,
    markdown: false,
    ...overrides,
  };
}

function makeCommit(overrides: Partial<CommitRecord> = {}): CommitRecord {
  return {
    id: 1,
    userEmail: "student@x.com",
    exerciseId: 1,
    commitTime: new Date(),
    status: 5,
    hash: null,
    corrects: 0,
    score: "0",
    compiled: true,
    compiledMessage: null,
    awsKey: "key",
    ip: null,
    ...overrides,
  };
}

function makeRepos() {
  const exercises: ExerciseRepository = {
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([]),
    findGhosts: vi.fn().mockResolvedValue([]),
    list: vi.fn(),
    listVisible: vi.fn(),
    countCases: vi.fn().mockResolvedValue(1),
    findAllowedExtensions: vi.fn().mockResolvedValue([]),
    listAllowedFiles: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    setAllowedFiles: vi.fn(),
  };
  const commits: CommitRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    listForUserOnExercise: vi.fn().mockResolvedValue([]),
    listLatestPerStudentForExercise: vi.fn().mockResolvedValue([]),
    listLatestForUserAcrossExercises: vi.fn().mockResolvedValue([]),
  };
  return { exercises, commits };
}

describe("MarketplaceStatsService.getStats", () => {
  it("returns zeroed-out stats and a null bucket when nobody has submitted", async () => {
    const repos = makeRepos();
    const service = new MarketplaceStatsService(repos.exercises, repos.commits);

    const stats = await service.getStats(1);

    expect(stats).toMatchObject({
      exerciseId: 1,
      adoptionCount: 0,
      totalSubmitters: 0,
      avgAttemptsToSuccess: 0,
      avgScore: 0,
      passRate: 0,
      difficultyBucket: null,
    });
  });

  it("counts adoptionCount from ghost clones pointing at this exercise", async () => {
    const repos = makeRepos();
    repos.exercises.findGhosts = vi.fn().mockResolvedValue([makeExercise({ id: 2 }), makeExercise({ id: 3 })]);
    const service = new MarketplaceStatsService(repos.exercises, repos.commits);

    const stats = await service.getStats(1);

    expect(stats.adoptionCount).toBe(2);
  });

  it("aggregates latest commits across the real exercise and every ghost copy", async () => {
    const repos = makeRepos();
    repos.exercises.findGhosts = vi.fn().mockResolvedValue([makeExercise({ id: 2, offeringId: 2 })]);
    repos.commits.listLatestPerStudentForExercise = vi.fn().mockImplementation((exerciseId: number) =>
      Promise.resolve(
        exerciseId === 1
          ? [makeCommit({ userEmail: "a@x.com", score: "10", exerciseId: 1 })]
          : [makeCommit({ userEmail: "b@x.com", score: "4", exerciseId: 2 })],
      ),
    );

    const service = new MarketplaceStatsService(repos.exercises, repos.commits);
    const stats = await service.getStats(1);

    expect(stats.totalSubmitters).toBe(2);
    expect(stats.passRate).toBe(50); // only a@x.com (score 10 > 5) passes
    expect(stats.avgScore).toBe(7); // (10 + 4) / 2
  });

  it("excludes students who never reached a fully-correct commit from avgAttemptsToSuccess", async () => {
    const repos = makeRepos();
    repos.exercises.countCases = vi.fn().mockResolvedValue(2);
    repos.commits.listLatestPerStudentForExercise = vi.fn().mockResolvedValue([
      makeCommit({ userEmail: "succeeds@x.com" }),
      makeCommit({ userEmail: "never@x.com" }),
    ]);
    repos.commits.listForUserOnExercise = vi.fn().mockImplementation((_exerciseId: number, email: string) => {
      if (email === "succeeds@x.com") {
        // Most-recent-first (repository contract) — 3rd attempt succeeds.
        return Promise.resolve([
          makeCommit({ corrects: 2, commitTime: new Date(3) }),
          makeCommit({ corrects: 1, commitTime: new Date(2) }),
          makeCommit({ corrects: 0, commitTime: new Date(1) }),
        ]);
      }
      return Promise.resolve([
        makeCommit({ corrects: 1, commitTime: new Date(2) }),
        makeCommit({ corrects: 0, commitTime: new Date(1) }),
      ]);
    });

    const service = new MarketplaceStatsService(repos.exercises, repos.commits);
    const stats = await service.getStats(1);

    expect(stats.avgAttemptsToSuccess).toBe(3);
  });

  it("buckets a high pass rate with few attempts as easy", async () => {
    const repos = makeRepos();
    repos.exercises.countCases = vi.fn().mockResolvedValue(1);
    repos.commits.listLatestPerStudentForExercise = vi.fn().mockResolvedValue([
      makeCommit({ userEmail: "a@x.com", score: "10", corrects: 1 }),
      makeCommit({ userEmail: "b@x.com", score: "10", corrects: 1 }),
    ]);
    repos.commits.listForUserOnExercise = vi.fn().mockResolvedValue([makeCommit({ corrects: 1 })]);

    const service = new MarketplaceStatsService(repos.exercises, repos.commits);
    const stats = await service.getStats(1);

    expect(stats.difficultyBucket).toBe("easy");
  });

  it("buckets a low pass rate as hard", async () => {
    const repos = makeRepos();
    repos.exercises.countCases = vi.fn().mockResolvedValue(1);
    repos.commits.listLatestPerStudentForExercise = vi.fn().mockResolvedValue([
      makeCommit({ userEmail: "a@x.com", score: "0", corrects: 0 }),
      makeCommit({ userEmail: "b@x.com", score: "0", corrects: 0 }),
      makeCommit({ userEmail: "c@x.com", score: "10", corrects: 1 }),
    ]);
    repos.commits.listForUserOnExercise = vi.fn().mockResolvedValue([]);

    const service = new MarketplaceStatsService(repos.exercises, repos.commits);
    const stats = await service.getStats(1);

    expect(stats.difficultyBucket).toBe("hard");
  });
});
