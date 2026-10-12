import { describe, it, expect, vi } from "vitest";
import { ExerciseAttachmentService } from "./exercise-attachment.service.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../domain/errors.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { AttachmentRepository, AttachmentRecord } from "../repositories/attachment.repository.js";
import type { AttachmentStorageRepository } from "../repositories/attachment-storage.repository.js";
import { UserType } from "../lib/constants.js";

function makeExercise(overrides: Partial<ExerciseRecord> = {}): ExerciseRecord {
  return {
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
    ...overrides,
  };
}

const ATTACHMENT: AttachmentRecord = { id: 1, exerciseId: 1, path: "helper.py" };

function makeRepos(overrides: { exercise?: ExerciseRecord | null; isStaff?: boolean; isEnrolled?: boolean } = {}) {
  const exercises: ExerciseRepository = {
    findById: vi.fn().mockResolvedValue("exercise" in overrides ? overrides.exercise : makeExercise()),
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
    isEnrolled: vi.fn().mockResolvedValue(overrides.isEnrolled ?? false),
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
  const attachments: AttachmentRepository = {
    listForExercise: vi.fn().mockResolvedValue([ATTACHMENT]),
    findById: vi.fn().mockResolvedValue(ATTACHMENT),
    create: vi.fn().mockResolvedValue(ATTACHMENT),
    delete: vi.fn().mockResolvedValue(true),
  };
  const storage: AttachmentStorageRepository = {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  return { exercises, enrollments, attachments, storage };
}

function buildService(repos: ReturnType<typeof makeRepos>) {
  return new ExerciseAttachmentService(repos.exercises, repos.enrollments, repos.attachments, repos.storage);
}

const STAFF = { email: "prof@x.com", type: 0 };
const STUDENT = { email: "student@x.com", type: 0 };
const ADMIN = { email: "admin@x.com", type: UserType.ADMIN };

describe("ExerciseAttachmentService.upload", () => {
  it("throws NotFoundError for a missing/removed exercise", async () => {
    const repos = makeRepos({ exercise: null });
    const service = buildService(repos);

    await expect(
      service.upload(1, STAFF, { filename: "x.py", content: Buffer.from("x") }),
    ).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(
      service.upload(1, STUDENT, { filename: "x.py", content: Buffer.from("x") }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a blocked extension", async () => {
    const repos = makeRepos({ isStaff: true });
    const service = buildService(repos);

    const promise = service.upload(1, STAFF, { filename: "shell.php", content: Buffer.from("x") });
    await expect(promise).rejects.toThrow(ValidationError);
    expect(repos.storage.put).not.toHaveBeenCalled();
  });

  it("uploads for staff and writes to storage then creates the metadata row", async () => {
    const repos = makeRepos({ isStaff: true });
    const service = buildService(repos);

    await service.upload(1, STAFF, { filename: "helper.py", content: Buffer.from("x") });

    expect(repos.storage.put).toHaveBeenCalledWith(1, "helper.py", Buffer.from("x"));
    expect(repos.attachments.create).toHaveBeenCalledWith(1, "helper.py");
  });

  it("redirects a ghost exercise's attachment to the real exercise id", async () => {
    const repos = makeRepos({ exercise: makeExercise({ ghost: true, realId: 42 }), isStaff: true });
    const service = buildService(repos);

    await service.upload(1, STAFF, { filename: "helper.py", content: Buffer.from("x") });

    expect(repos.storage.put).toHaveBeenCalledWith(42, "helper.py", Buffer.from("x"));
    expect(repos.attachments.create).toHaveBeenCalledWith(42, "helper.py");
  });

  it("cleans up the uploaded S3 object if the metadata write fails", async () => {
    const repos = makeRepos({ isStaff: true });
    repos.attachments.create = vi.fn().mockRejectedValue(new Error("db down"));
    const service = buildService(repos);

    await expect(
      service.upload(1, STAFF, { filename: "helper.py", content: Buffer.from("x") }),
    ).rejects.toThrow("db down");
    expect(repos.storage.delete).toHaveBeenCalledWith(1, "helper.py");
  });
});

describe("ExerciseAttachmentService.list", () => {
  it("is forbidden without enrollment", async () => {
    const repos = makeRepos({ isStaff: false, isEnrolled: false });
    const service = buildService(repos);

    await expect(service.list(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("allows an enrolled student", async () => {
    const repos = makeRepos({ isEnrolled: true });
    const service = buildService(repos);

    await expect(service.list(1, STUDENT)).resolves.toEqual([ATTACHMENT]);
  });

  it("allows an admin without an enrollment check", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await service.list(1, ADMIN);
    expect(repos.enrollments.isEnrolled).not.toHaveBeenCalled();
  });

  it("redirects a ghost exercise's list to the real exercise's attachments", async () => {
    const repos = makeRepos({ exercise: makeExercise({ ghost: true, realId: 42 }), isEnrolled: true });
    const service = buildService(repos);

    await service.list(1, STUDENT);

    expect(repos.attachments.listForExercise).toHaveBeenCalledWith(42);
  });
});

describe("ExerciseAttachmentService.getContent", () => {
  it("throws NotFoundError for a missing attachment", async () => {
    const repos = makeRepos();
    repos.attachments.findById = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(service.getContent(1, STUDENT)).rejects.toThrow(NotFoundError);
  });

  it("returns the file content for an enrolled requester", async () => {
    const repos = makeRepos({ isEnrolled: true });
    const service = buildService(repos);

    const result = await service.getContent(1, STUDENT);
    expect(result.filename).toBe("helper.py");
    expect(result.content).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe("ExerciseAttachmentService.delete", () => {
  it("is forbidden for a non-staff requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.delete(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("deletes the metadata row then best-effort cleans up S3", async () => {
    const repos = makeRepos({ isStaff: true });
    const service = buildService(repos);

    await service.delete(1, STAFF);

    expect(repos.attachments.delete).toHaveBeenCalledWith(1);
    expect(repos.storage.delete).toHaveBeenCalledWith(1, "helper.py");
  });
});
