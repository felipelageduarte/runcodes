import { describe, it, expect, vi } from "vitest";
import { OfferingMembershipService } from "./offering-membership.service.js";
import { ForbiddenError, NotFoundError } from "../domain/errors.js";
import { EnrollmentRole } from "../repositories/enrollment.repository.js";
import type { EnrollmentRepository, EnrollmentRecord } from "../repositories/enrollment.repository.js";
import type { UserRepository, UserRecord } from "../repositories/user.repository.js";
import { UserType } from "../lib/constants.js";

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
  };
  const users: UserRepository = {
    findByEmail: vi.fn().mockResolvedValue(TARGET_USER),
    updatePassword: vi.fn(),
    existsByEmail: vi.fn(),
    create: vi.fn(),
    findConfirmationState: vi.fn(),
    confirm: vi.fn(),
  };
  return { enrollments, users };
}

const STUDENT_REQUESTER = { email: "random@x.com", type: 0 };
const ADMIN_REQUESTER = { email: "admin@x.com", type: UserType.ADMIN };

describe("OfferingMembershipService.setProfessor/setAssistant/setStudent", () => {
  it("is forbidden for a requester who is neither staff nor admin", async () => {
    const repos = makeRepos({ staff: false });
    const service = new OfferingMembershipService(repos.enrollments, repos.users);

    await expect(
      service.setProfessor(1, "student@x.com", STUDENT_REQUESTER),
    ).rejects.toThrow(ForbiddenError);
    expect(repos.enrollments.setRole).not.toHaveBeenCalled();
  });

  it("allows staff of the offering", async () => {
    const repos = makeRepos({ staff: true });
    const service = new OfferingMembershipService(repos.enrollments, repos.users);

    await service.setAssistant(1, "student@x.com", { email: "prof@x.com", type: 0 });

    expect(repos.enrollments.setRole).toHaveBeenCalledWith(1, "student@x.com", EnrollmentRole.ASSISTANT);
  });

  it("allows an admin regardless of staff status", async () => {
    const repos = makeRepos({ staff: false });
    const service = new OfferingMembershipService(repos.enrollments, repos.users);

    await service.setStudent(1, "student@x.com", ADMIN_REQUESTER);

    expect(repos.enrollments.setRole).toHaveBeenCalledWith(1, "student@x.com", EnrollmentRole.STUDENT);
  });

  it("throws NotFoundError when the target user doesn't exist", async () => {
    const repos = makeRepos({ staff: true });
    repos.users.findByEmail = vi.fn().mockResolvedValue(null);
    const service = new OfferingMembershipService(repos.enrollments, repos.users);

    await expect(
      service.setProfessor(1, "ghost@x.com", { email: "prof@x.com", type: 0 }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the target has no enrollment in the offering", async () => {
    const repos = makeRepos({ staff: true });
    repos.enrollments.setRole = vi.fn().mockResolvedValue(null);
    const service = new OfferingMembershipService(repos.enrollments, repos.users);

    const promise = service.setProfessor(1, "student@x.com", { email: "prof@x.com", type: 0 });
    await expect(promise).rejects.toMatchObject({ code: "user_not_enrolled" });
  });
});

describe("OfferingMembershipService.ban", () => {
  it("is forbidden for staff who isn't an admin", async () => {
    const repos = makeRepos({ staff: true });
    const service = new OfferingMembershipService(repos.enrollments, repos.users);

    await expect(
      service.ban(1, "student@x.com", { email: "prof@x.com", type: 0 }),
    ).rejects.toThrow(ForbiddenError);
    expect(repos.enrollments.ban).not.toHaveBeenCalled();
  });

  it("allows an admin", async () => {
    const repos = makeRepos();
    const service = new OfferingMembershipService(repos.enrollments, repos.users);

    const result = await service.ban(1, "student@x.com", ADMIN_REQUESTER);

    expect(result.banned).toBe(true);
    expect(repos.enrollments.ban).toHaveBeenCalledWith(1, "student@x.com");
  });

  it("throws NotFoundError when the target has no enrollment in the offering", async () => {
    const repos = makeRepos();
    repos.enrollments.ban = vi.fn().mockResolvedValue(null);
    const service = new OfferingMembershipService(repos.enrollments, repos.users);

    await expect(service.ban(1, "student@x.com", ADMIN_REQUESTER)).rejects.toThrow(NotFoundError);
  });
});
