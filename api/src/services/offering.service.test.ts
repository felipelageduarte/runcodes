import { describe, it, expect, vi } from "vitest";
import { OfferingService } from "./offering.service.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { OfferingRepository, OfferingRecord } from "../repositories/offering.repository.js";
import type { CourseRepository, CourseRecord } from "../repositories/course.repository.js";
import type { UniversityRepository } from "../repositories/university.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { CommitRepository, CommitRecord } from "../repositories/commit.repository.js";
import type { UserRepository, UserRecord } from "../repositories/user.repository.js";
import type { EmailSender } from "../repositories/email-sender.js";
import { UserType } from "../lib/constants.js";

const OFFERING: OfferingRecord = {
  id: 1,
  courseId: 10,
  year: 2026,
  term: 1,
  classroom: "A",
  endDate: new Date("2099-01-01"),
  enrollmentCode: null,
  maxStudents: 0,
  maxExercises: 0,
};
const COURSE: CourseRecord = { id: 10, code: "X", title: "X", universityId: 1 };

function makeRepos() {
  const offerings: OfferingRepository = {
    list: vi.fn().mockResolvedValue({ total: 1, offerings: [OFFERING] }),
    findById: vi.fn().mockResolvedValue(OFFERING),
    findByIds: vi.fn().mockResolvedValue([OFFERING]),
    findByEnrollmentCode: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(OFFERING),
    update: vi.fn().mockResolvedValue(OFFERING),
  };
  const courses: CourseRepository = {
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(COURSE),
    searchByUniversity: vi.fn(),
  };
  const universities: UniversityRepository = {
    findByIds: vi.fn().mockResolvedValue(new Map()),
    findById: vi.fn(),
    list: vi.fn(),
    existsByAbbreviation: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const enrollments: EnrollmentRepository = {
    isEnrolled: vi.fn().mockResolvedValue(false),
    isStaff: vi.fn().mockResolvedValue(false),
    findOne: vi.fn(),
    listForUser: vi.fn().mockResolvedValue([1]),
    listRecordsForUser: vi.fn(),
    listStaffForOfferings: vi.fn().mockResolvedValue(new Map()),
    create: vi.fn(),
    setRole: vi.fn(),
    ban: vi.fn(),
    listStudentsForOffering: vi.fn(),
    delete: vi.fn(),
    listMemberEmails: vi.fn().mockResolvedValue(["a@x.com", "b@x.com"]),
  };
  const exercises: ExerciseRepository = {
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([]),
    findGhosts: vi.fn().mockResolvedValue([]),
    list: vi.fn(),
    listVisible: vi.fn().mockResolvedValue([]),
    countCases: vi.fn(),
    findAllowedExtensions: vi.fn(),
    listAllowedFiles: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    setAllowedFiles: vi.fn(),
  };
  const commits: CommitRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    listForUserOnExercise: vi.fn(),
    listLatestPerStudentForExercise: vi.fn(),
    listLatestForUserAcrossExercises: vi.fn().mockResolvedValue([]),
  };
  const PROFESSOR_USER: UserRecord = {
    email: "prof@x.com",
    name: "Prof",
    password: "",
    type: UserType.PROFESSOR,
    universityId: 1,
    confirmed: true,
    identifier: null,
  };
  const users: UserRepository = {
    findByEmail: vi.fn().mockResolvedValue(PROFESSOR_USER),
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
  const emailSender: EmailSender = { send: vi.fn().mockResolvedValue(undefined) };
  return { offerings, courses, universities, enrollments, exercises, commits, users, emailSender };
}

function buildService(repos: ReturnType<typeof makeRepos>) {
  return new OfferingService(
    repos.offerings,
    repos.courses,
    repos.universities,
    repos.enrollments,
    repos.exercises,
    repos.commits,
    repos.users,
    repos.emailSender,
  );
}

describe("OfferingService.getDetail", () => {
  it("throws NotFoundError for a missing offering", async () => {
    const repos = makeRepos();
    repos.offerings.findById = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(service.getDetail(1, { email: "s@x.com", type: 0 })).rejects.toThrow(NotFoundError);
  });

  it("throws ForbiddenError for an unenrolled, non-staff, non-admin user", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await expect(service.getDetail(1, { email: "s@x.com", type: 0 })).rejects.toThrow(ForbiddenError);
  });

  it("allows an admin without checking enrollment", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await service.getDetail(1, { email: "admin@x.com", type: UserType.ADMIN });

    expect(repos.enrollments.isEnrolled).not.toHaveBeenCalled();
    expect(repos.exercises.listVisible).toHaveBeenCalledWith({ offeringId: 1, includeUnopened: true });
  });

  it("allows an enrolled student and hides unopened exercises", async () => {
    const repos = makeRepos();
    repos.enrollments.isEnrolled = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    await service.getDetail(1, { email: "s@x.com", type: 0 });

    expect(repos.exercises.listVisible).toHaveBeenCalledWith({ offeringId: 1, includeUnopened: false });
  });

  it("treats a professor/assistant enrollment as staff and shows unopened exercises", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    await service.getDetail(1, { email: "prof@x.com", type: 0 });

    expect(repos.exercises.listVisible).toHaveBeenCalledWith({ offeringId: 1, includeUnopened: true });
  });

  it("embeds the student's own latest commit per exercise, null when they never submitted", async () => {
    const exercise1: ExerciseRecord = {
      id: 1,
      offeringId: 1,
      title: "Ex1",
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
    const exercise2 = { ...exercise1, id: 2, title: "Ex2" };
    const commit: CommitRecord = {
      id: 5,
      userEmail: "s@x.com",
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
    const repos = makeRepos();
    repos.enrollments.isEnrolled = vi.fn().mockResolvedValue(true);
    repos.exercises.listVisible = vi.fn().mockResolvedValue([exercise1, exercise2]);
    repos.commits.listLatestForUserAcrossExercises = vi.fn().mockResolvedValue([commit]);
    const service = buildService(repos);

    const result = await service.getDetail(1, { email: "s@x.com", type: 0 });

    expect(repos.commits.listLatestForUserAcrossExercises).toHaveBeenCalledWith("s@x.com", [1, 2]);
    expect(result.exercises[0].myLatestCommit).toEqual(commit);
    expect(result.exercises[1].myLatestCommit).toBeNull();
  });

  it("skips the per-student commit lookup entirely for staff", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    await service.getDetail(1, { email: "prof@x.com", type: 0 });

    expect(repos.commits.listLatestForUserAcrossExercises).not.toHaveBeenCalled();
  });
});

describe("OfferingService.listMine", () => {
  it("returns empty open/closed when the user has no enrollments", async () => {
    const repos = makeRepos();
    repos.enrollments.listForUser = vi.fn().mockResolvedValue([]);
    const service = buildService(repos);

    await expect(service.listMine("s@x.com")).resolves.toEqual({ open: [], closed: [] });
    expect(repos.offerings.findByIds).not.toHaveBeenCalled();
  });

  it("splits offerings into open/closed by end date", async () => {
    const repos = makeRepos();
    const openOffering = { ...OFFERING, id: 1, endDate: new Date(Date.now() + 86_400_000) };
    const closedOffering = { ...OFFERING, id: 2, endDate: new Date(Date.now() - 86_400_000) };
    repos.offerings.findByIds = vi.fn().mockResolvedValue([openOffering, closedOffering]);
    const service = buildService(repos);

    const result = await service.listMine("s@x.com");

    expect(result.open.map((o) => o.id)).toEqual([1]);
    expect(result.closed.map((o) => o.id)).toEqual([2]);
  });
});

describe("OfferingService.create", () => {
  const INPUT = { courseId: 10, classroom: "A", endDate: new Date("2099-01-01") };

  it("rejects a requester below professor", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await expect(service.create({ email: "s@x.com", type: UserType.STUDENT }, INPUT)).rejects.toThrow(
      ForbiddenError,
    );
    expect(repos.offerings.create).not.toHaveBeenCalled();
  });

  it("rejects when the course belongs to a different university than the requester", async () => {
    const repos = makeRepos();
    repos.users.findByEmail = vi.fn().mockResolvedValue({
      email: "prof@x.com",
      name: "Prof",
      password: "",
      type: UserType.PROFESSOR,
      universityId: 2,
      confirmed: true,
      identifier: null,
    });
    const service = buildService(repos);

    await expect(
      service.create({ email: "prof@x.com", type: UserType.PROFESSOR }, INPUT),
    ).rejects.toThrow(ForbiddenError);
    expect(repos.offerings.create).not.toHaveBeenCalled();
  });

  it("creates the offering, enrolls the requester as professor, and emails the code", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const result = await service.create({ email: "prof@x.com", type: UserType.PROFESSOR }, INPUT);

    expect(result).toEqual(OFFERING);
    expect(repos.offerings.create).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: 10, classroom: "A", endDate: INPUT.endDate }),
    );
    expect(repos.enrollments.create).toHaveBeenCalledWith(OFFERING.id, "prof@x.com", 2);
    expect(repos.emailSender.send).toHaveBeenCalledWith(expect.objectContaining({ to: "prof@x.com" }));
  });

  it("retries code generation until it finds one not already in use", async () => {
    const repos = makeRepos();
    repos.offerings.findByEnrollmentCode = vi
      .fn()
      .mockResolvedValueOnce(OFFERING)
      .mockResolvedValueOnce(null);
    const service = buildService(repos);

    await service.create({ email: "prof@x.com", type: UserType.PROFESSOR }, INPUT);

    expect(repos.offerings.findByEnrollmentCode).toHaveBeenCalledTimes(2);
  });

  it("doesn't fail the whole operation when the confirmation email fails to send", async () => {
    const repos = makeRepos();
    repos.emailSender.send = vi.fn().mockRejectedValue(new Error("smtp down"));
    const service = buildService(repos);

    await expect(service.create({ email: "prof@x.com", type: UserType.PROFESSOR }, INPUT)).resolves.toEqual(
      OFFERING,
    );
  });
});

describe("OfferingService.update", () => {
  it("throws NotFoundError for a missing offering", async () => {
    const repos = makeRepos();
    repos.offerings.findById = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(
      service.update(1, { email: "prof@x.com", type: UserType.PROFESSOR }, { classroom: "B" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects a non-staff, non-admin requester", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await expect(
      service.update(1, { email: "s@x.com", type: UserType.STUDENT }, { classroom: "B" }),
    ).rejects.toThrow(ForbiddenError);
    expect(repos.offerings.update).not.toHaveBeenCalled();
  });

  it("allows staff of this offering to update it", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    await service.update(1, { email: "prof@x.com", type: UserType.PROFESSOR }, { classroom: "B" });

    expect(repos.offerings.update).toHaveBeenCalledWith(1, { classroom: "B" });
  });

  it("allows an admin regardless of staff membership", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await service.update(1, { email: "admin@x.com", type: UserType.ADMIN }, { classroom: "B" });

    expect(repos.enrollments.isStaff).not.toHaveBeenCalled();
    expect(repos.offerings.update).toHaveBeenCalledWith(1, { classroom: "B" });
  });
});

describe("OfferingService.emailMembers", () => {
  it("throws NotFoundError for a missing offering", async () => {
    const repos = makeRepos();
    repos.offerings.findById = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(
      service.emailMembers(1, { email: "prof@x.com", type: UserType.PROFESSOR }, { subject: "Oi", message: "Msg" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects a non-staff, non-admin requester", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await expect(
      service.emailMembers(1, { email: "s@x.com", type: UserType.STUDENT }, { subject: "Oi", message: "Msg" }),
    ).rejects.toThrow(ForbiddenError);
    expect(repos.emailSender.send).not.toHaveBeenCalled();
  });

  it("emails every non-banned member and returns the recipient count", async () => {
    const repos = makeRepos();
    repos.enrollments.isStaff = vi.fn().mockResolvedValue(true);
    const service = buildService(repos);

    const result = await service.emailMembers(
      1,
      { email: "prof@x.com", type: UserType.PROFESSOR },
      { subject: "Prova remarcada", message: "Nova data: sexta" },
    );

    expect(result).toEqual({ count: 2 });
    expect(repos.emailSender.send).toHaveBeenCalledTimes(2);
    expect(repos.emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@x.com", subject: expect.stringContaining("Prova remarcada") }),
    );
  });
});
