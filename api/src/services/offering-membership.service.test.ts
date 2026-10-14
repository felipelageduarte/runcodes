import { describe, it, expect, vi } from "vitest";
import { OfferingMembershipService } from "./offering-membership.service.js";
import { ForbiddenError, NotFoundError } from "../domain/errors.js";
import { EnrollmentRole } from "../repositories/enrollment.repository.js";
import type { EnrollmentRepository, EnrollmentRecord } from "../repositories/enrollment.repository.js";
import type { UserRepository, UserRecord } from "../repositories/user.repository.js";
import type { OfferingRepository, OfferingRecord } from "../repositories/offering.repository.js";
import type { CourseRepository, CourseRecord } from "../repositories/course.repository.js";
import { UserType } from "../lib/constants.js";

const OFFERING: OfferingRecord = {
  id: 1,
  courseId: 10,
  year: 2026,
  term: 1,
  classroom: "A",
  endDate: new Date("2099-01-01"),
  enrollmentCode: "ABCD",
  maxStudents: 0,
  maxExercises: 0,
};
const COURSE: CourseRecord = { id: 10, code: "X", title: "X", universityId: 1 };

const ENROLLMENT: EnrollmentRecord = {
  id: 1,
  offeringId: 1,
  userEmail: "student@x.com",
  role: EnrollmentRole.STUDENT,
  banned: false,
};
const TARGET_USER: UserRecord = {
  email: "student@x.com",
  name: "Student",
  password: "",
  type: 0,
  universityId: 1,
  confirmed: true,
  identifier: null,
};

function makeRepos(overrides: { staff?: boolean } = {}) {
  const enrollments: EnrollmentRepository = {
    isEnrolled: vi.fn(),
    isStaff: vi.fn().mockResolvedValue(overrides.staff ?? false),
    findOne: vi.fn(),
    listForUser: vi.fn(),
    listRecordsForUser: vi.fn(),
    listStaffForOfferings: vi.fn(),
    create: vi.fn(),
    setRole: vi.fn().mockResolvedValue({ ...ENROLLMENT, role: EnrollmentRole.PROFESSOR }),
    ban: vi.fn().mockResolvedValue({ ...ENROLLMENT, banned: true }),
    listStudentsForOffering: vi.fn(),
    delete: vi.fn().mockResolvedValue(true),
  };
  const users: UserRepository = {
    findByEmail: vi.fn().mockResolvedValue(TARGET_USER),
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
  const offerings: OfferingRepository = {
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(OFFERING),
    findByIds: vi.fn(),
    findByEnrollmentCode: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const courses: CourseRepository = {
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(COURSE),
    searchByUniversity: vi.fn(),
    existsByCode: vi.fn(),
    create: vi.fn(),
  };
  return { enrollments, users, offerings, courses };
}

function buildService(repos: ReturnType<typeof makeRepos>) {
  return new OfferingMembershipService(repos.enrollments, repos.users, repos.offerings, repos.courses);
}

const STUDENT_REQUESTER = { email: "random@x.com", type: 0 };
const ADMIN_REQUESTER = { email: "admin@x.com", type: UserType.ADMIN };

describe("OfferingMembershipService.setProfessor/setAssistant/setStudent", () => {
  it("is forbidden for a requester who is neither staff nor admin", async () => {
    const repos = makeRepos({ staff: false });
    const service = buildService(repos);

    await expect(
      service.setProfessor(1, "student@x.com", STUDENT_REQUESTER),
    ).rejects.toThrow(ForbiddenError);
    expect(repos.enrollments.setRole).not.toHaveBeenCalled();
  });

  it("allows staff of the offering", async () => {
    const repos = makeRepos({ staff: true });
    const service = buildService(repos);

    await service.setAssistant(1, "student@x.com", { email: "prof@x.com", type: 0 });

    expect(repos.enrollments.setRole).toHaveBeenCalledWith(1, "student@x.com", EnrollmentRole.ASSISTANT);
  });

  it("allows an admin regardless of staff status", async () => {
    const repos = makeRepos({ staff: false });
    const service = buildService(repos);

    await service.setStudent(1, "student@x.com", ADMIN_REQUESTER);

    expect(repos.enrollments.setRole).toHaveBeenCalledWith(1, "student@x.com", EnrollmentRole.STUDENT);
  });

  it("throws NotFoundError when the target user doesn't exist", async () => {
    const repos = makeRepos({ staff: true });
    repos.users.findByEmail = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(
      service.setProfessor(1, "ghost@x.com", { email: "prof@x.com", type: 0 }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the target has no enrollment in the offering", async () => {
    const repos = makeRepos({ staff: true });
    repos.enrollments.setRole = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    const promise = service.setProfessor(1, "student@x.com", { email: "prof@x.com", type: 0 });
    await expect(promise).rejects.toMatchObject({ code: "user_not_enrolled" });
  });
});

describe("OfferingMembershipService.ban", () => {
  it("is forbidden for staff who isn't an admin", async () => {
    const repos = makeRepos({ staff: true });
    const service = buildService(repos);

    await expect(
      service.ban(1, "student@x.com", { email: "prof@x.com", type: 0 }),
    ).rejects.toThrow(ForbiddenError);
    expect(repos.enrollments.ban).not.toHaveBeenCalled();
  });

  it("allows an admin", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const result = await service.ban(1, "student@x.com", ADMIN_REQUESTER);

    expect(result.banned).toBe(true);
    expect(repos.enrollments.ban).toHaveBeenCalledWith(1, "student@x.com");
  });

  it("throws NotFoundError when the target has no enrollment in the offering", async () => {
    const repos = makeRepos();
    repos.enrollments.ban = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(service.ban(1, "student@x.com", ADMIN_REQUESTER)).rejects.toThrow(NotFoundError);
  });
});

describe("OfferingMembershipService.enrollManually", () => {
  it("is forbidden for a requester who is neither staff nor admin", async () => {
    const repos = makeRepos({ staff: false });
    repos.enrollments.findOne = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(
      service.enrollManually(1, "student@x.com", STUDENT_REQUESTER),
    ).rejects.toThrow(ForbiddenError);
    expect(repos.enrollments.create).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the target user doesn't exist", async () => {
    const repos = makeRepos({ staff: true });
    repos.users.findByEmail = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await expect(
      service.enrollManually(1, "ghost@x.com", { email: "prof@x.com", type: 0 }),
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects when the target belongs to a different university than the course", async () => {
    const repos = makeRepos({ staff: true });
    repos.enrollments.findOne = vi.fn().mockResolvedValue(null);
    repos.users.findByEmail = vi.fn().mockResolvedValue({ ...TARGET_USER, universityId: 2 });
    const service = buildService(repos);

    await expect(
      service.enrollManually(1, "student@x.com", { email: "prof@x.com", type: 0 }),
    ).rejects.toMatchObject({ code: "wrong_university" });
  });

  it("rejects when the target is already enrolled", async () => {
    const repos = makeRepos({ staff: true });
    repos.enrollments.findOne = vi.fn().mockResolvedValue(ENROLLMENT);
    const service = buildService(repos);

    await expect(
      service.enrollManually(1, "student@x.com", { email: "prof@x.com", type: 0 }),
    ).rejects.toMatchObject({ code: "already_enrolled" });
  });

  it("rejects with banned_from_offering when the target was banned before", async () => {
    const repos = makeRepos({ staff: true });
    repos.enrollments.findOne = vi.fn().mockResolvedValue({ ...ENROLLMENT, banned: true });
    const service = buildService(repos);

    await expect(
      service.enrollManually(1, "student@x.com", { email: "prof@x.com", type: 0 }),
    ).rejects.toMatchObject({ code: "banned_from_offering" });
  });

  it("creates a student enrollment when staff of the offering targets a valid user", async () => {
    const repos = makeRepos({ staff: true });
    repos.enrollments.findOne = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await service.enrollManually(1, "student@x.com", { email: "prof@x.com", type: 0 });

    expect(repos.enrollments.create).toHaveBeenCalledWith(1, "student@x.com", EnrollmentRole.STUDENT);
  });

  it("allows an admin regardless of staff status", async () => {
    const repos = makeRepos({ staff: false });
    repos.enrollments.findOne = vi.fn().mockResolvedValue(null);
    const service = buildService(repos);

    await service.enrollManually(1, "student@x.com", ADMIN_REQUESTER);

    expect(repos.enrollments.create).toHaveBeenCalledWith(1, "student@x.com", EnrollmentRole.STUDENT);
  });
});

describe("OfferingMembershipService.unenroll", () => {
  it("is forbidden for a requester who is neither staff nor admin", async () => {
    const repos = makeRepos({ staff: false });
    const service = buildService(repos);

    await expect(service.unenroll(1, "student@x.com", STUDENT_REQUESTER)).rejects.toThrow(ForbiddenError);
    expect(repos.enrollments.delete).not.toHaveBeenCalled();
  });

  it("allows staff of the offering to hard-delete a matrícula", async () => {
    const repos = makeRepos({ staff: true });
    const service = buildService(repos);

    await service.unenroll(1, "student@x.com", { email: "prof@x.com", type: 0 });

    expect(repos.enrollments.delete).toHaveBeenCalledWith(1, "student@x.com");
  });

  it("throws NotFoundError when the target has no enrollment in the offering", async () => {
    const repos = makeRepos({ staff: true });
    repos.enrollments.delete = vi.fn().mockResolvedValue(false);
    const service = buildService(repos);

    await expect(
      service.unenroll(1, "student@x.com", { email: "prof@x.com", type: 0 }),
    ).rejects.toMatchObject({ code: "user_not_enrolled" });
  });
});
