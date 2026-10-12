import { describe, it, expect, vi } from "vitest";
import { ExerciseExportService } from "./exercise-export.service.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { CommitRepository, CommitRecord } from "../repositories/commit.repository.js";
import type { StorageRepository } from "../repositories/storage.repository.js";
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
    awsKey: "10/abc-main.py",
    ip: null,
    ...overrides,
  };
}

function makeRepos(
  overrides: { exercise?: ExerciseRecord | null; isStaff?: boolean; commits?: CommitRecord[] } = {},
) {
  const exercises: ExerciseRepository = {
    findById: vi.fn().mockResolvedValue("exercise" in overrides ? overrides.exercise : EXERCISE),
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
  const commits: CommitRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    listForUserOnExercise: vi.fn(),
    listLatestPerStudentForExercise: vi.fn().mockResolvedValue(overrides.commits ?? [makeCommit()]),
  };
  const storage: StorageRepository = {
    putCommitFile: vi.fn(),
    getCommitFile: vi.fn().mockResolvedValue(new Uint8Array(Buffer.from("print('hi')"))),
  };
  const users: UserRepository = {
    findByEmail: vi.fn().mockResolvedValue({
      email: "alice@x.com",
      name: "Alice",
      password: "",
      type: 0,
      universityId: 1,
      confirmed: true,
      identifier: "111",
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
  return { exercises, enrollments, commits, storage, users };
}

function buildService(repos: ReturnType<typeof makeRepos>) {
  return new ExerciseExportService(repos.exercises, repos.enrollments, repos.commits, repos.storage, repos.users);
}

const STAFF = { email: "prof@x.com", type: 0 };
const STUDENT = { email: "alice@x.com", type: 0 };
const ADMIN = { email: "admin@x.com", type: UserType.ADMIN };

async function drain(archive: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of archive) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

describe("ExerciseExportService.buildLatestSubmissionsZip", () => {
  it("throws NotFoundError for a missing exercise", async () => {
    const repos = makeRepos({ exercise: null });
    const service = buildService(repos);

    await expect(service.buildLatestSubmissionsZip(10, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff, non-admin requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.buildLatestSubmissionsZip(10, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("allows an admin without an enrollment check", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    const { archive } = await service.buildLatestSubmissionsZip(10, ADMIN);
    await drain(archive);
    expect(repos.enrollments.isStaff).not.toHaveBeenCalled();
  });

  it("produces a non-empty zip, fetching each student's latest commit file by their aws key", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const { filename, archive } = await service.buildLatestSubmissionsZip(10, STAFF);
    const buffer = await drain(archive);

    expect(filename).toBe("Ex.zip");
    expect(buffer.subarray(0, 2).toString()).toBe("PK"); // zip local-file-header signature
    expect(repos.storage.getCommitFile).toHaveBeenCalledWith("10/abc-main.py");
  });

  it("skips students whose latest commit never finished uploading (no aws key)", async () => {
    const repos = makeRepos({ commits: [makeCommit({ awsKey: null })] });
    const service = buildService(repos);

    const { archive } = await service.buildLatestSubmissionsZip(10, STAFF);
    await drain(archive);

    expect(repos.storage.getCommitFile).not.toHaveBeenCalled();
  });
});
