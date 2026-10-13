import { describe, it, expect, vi } from "vitest";
import { PublicExerciseService } from "./public-exercise.service.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../domain/errors.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type {
  PublicExerciseRepository,
  PublicExerciseRecord,
} from "../repositories/public-exercise.repository.js";
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

const PUBLIC_ENTRY: PublicExerciseRecord = {
  id: 1,
  exerciseId: 1,
  level: 1,
  obs: null,
  keywords: "loops",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

function makeRepos(overrides: { exercise?: ExerciseRecord | null; existing?: PublicExerciseRecord | null } = {}) {
  const exercises: ExerciseRepository = {
    findById: vi.fn().mockResolvedValue("exercise" in overrides ? overrides.exercise : EXERCISE),
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
  const publicExercises: PublicExerciseRepository = {
    findByExerciseId: vi.fn().mockResolvedValue(overrides.existing ?? null),
    create: vi.fn().mockResolvedValue(PUBLIC_ENTRY),
    list: vi.fn().mockResolvedValue({ total: 1, entries: [PUBLIC_ENTRY] }),
    listAll: vi.fn().mockResolvedValue([PUBLIC_ENTRY]),
  };
  return { exercises, publicExercises };
}

const STUDENT = { email: "student@x.com", type: 0 };
const PROFESSOR = { email: "prof@x.com", type: UserType.PROFESSOR };

describe("PublicExerciseService.publish", () => {
  it("is forbidden below professor", async () => {
    const repos = makeRepos();
    const service = new PublicExerciseService(repos.exercises, repos.publicExercises);

    await expect(
      service.publish(1, STUDENT, { level: 1, obs: null, keywords: null }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError for a missing/removed exercise", async () => {
    const repos = makeRepos({ exercise: null });
    const service = new PublicExerciseService(repos.exercises, repos.publicExercises);

    await expect(
      service.publish(1, PROFESSOR, { level: 1, obs: null, keywords: null }),
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects publishing the same exercise twice", async () => {
    const repos = makeRepos({ existing: PUBLIC_ENTRY });
    const service = new PublicExerciseService(repos.exercises, repos.publicExercises);

    await expect(
      service.publish(1, PROFESSOR, { level: 1, obs: null, keywords: null }),
    ).rejects.toThrow(ConflictError);
  });

  it("publishes for a professor", async () => {
    const repos = makeRepos();
    const service = new PublicExerciseService(repos.exercises, repos.publicExercises);

    await expect(service.publish(1, PROFESSOR, { level: 1, obs: null, keywords: "loops" })).resolves.toEqual(
      PUBLIC_ENTRY,
    );
  });
});

describe("PublicExerciseService.list", () => {
  it("is forbidden below professor", async () => {
    const repos = makeRepos();
    const service = new PublicExerciseService(repos.exercises, repos.publicExercises);

    await expect(service.list(1, 10, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("lists for professor+", async () => {
    const repos = makeRepos();
    const service = new PublicExerciseService(repos.exercises, repos.publicExercises);

    await expect(service.list(1, 10, PROFESSOR)).resolves.toMatchObject({ total: 1 });
  });
});
