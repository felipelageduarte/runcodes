import { describe, it, expect, vi } from "vitest";
import { EnrollmentService } from "./enrollment.service.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../domain/errors.js";
import type { EnrollmentRepository, EnrollmentRecord } from "../repositories/enrollment.repository.js";
import type { OfferingRepository, OfferingRecord } from "../repositories/offering.repository.js";
import type { CourseRepository, CourseRecord } from "../repositories/course.repository.js";
import type { UserRepository, UserRecord } from "../repositories/user.repository.js";

const OFFERING: OfferingRecord = {
  id: 1,
  courseId: 10,
  year: 2026,
  term: 1,
  classroom: "A",
  endDate: new Date("2099-01-01"),
  enrollmentCode: "ABC123",
  maxStudents: 0,
  maxExercises: 0,
};

const COURSE: CourseRecord = { id: 10, code: "X", title: "X", universityId: 1 };

function makeRepos(overrides: {
  offering?: OfferingRecord | null;
  course?: CourseRecord | null;
  user?: UserRecord | null;
  existingEnrollment?: EnrollmentRecord | null;
} = {}) {
  const enrollments: EnrollmentRepository = {
    isEnrolled: vi.fn(),
    isStaff: vi.fn(),
    findOne: vi.fn().mockResolvedValue(overrides.existingEnrollment ?? null),
    listForUser: vi.fn(),
    listRecordsForUser: vi.fn().mockResolvedValue([]),
    listStaffForOfferings: vi.fn(),
    create: vi.fn().mockImplementation((offeringId, userEmail, role) =>
      Promise.resolve({ id: 99, offeringId, userEmail, role, banned: false }),
    ),
  };
  const offerings: OfferingRepository = {
    list: vi.fn(),
    findById: vi.fn(),
    findByIds: vi.fn(),
    findByEnrollmentCode: vi
      .fn()
      .mockResolvedValue("offering" in overrides ? overrides.offering : OFFERING),
  };
  const courses: CourseRepository = {
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(overrides.course ?? COURSE),
    searchByUniversity: vi.fn(),
  };
  const users: UserRepository = {
    findByEmail: vi
      .fn()
      .mockResolvedValue(overrides.user ?? { email: "s@x.com", name: "S", password: "", type: 0, universityId: 1 }),
    updatePassword: vi.fn(),
  };
  return { enrollments, offerings, courses, users };
}

describe("EnrollmentService.enrollByCode", () => {
  it("rejects an unknown code", async () => {
    const repos = makeRepos({ offering: null });
    const service = new EnrollmentService(repos.enrollments, repos.offerings, repos.courses, repos.users);

    await expect(service.enrollByCode("s@x.com", "NOPE")).rejects.toThrow(NotFoundError);
  });

  it("rejects when the offering belongs to a different university", async () => {
    const repos = makeRepos({
      course: { id: 10, code: "X", title: "X", universityId: 2 },
      user: { email: "s@x.com", name: "S", password: "", type: 0, universityId: 1 },
    });
    const service = new EnrollmentService(repos.enrollments, repos.offerings, repos.courses, repos.users);

    await expect(service.enrollByCode("s@x.com", "ABC123")).rejects.toThrow(ForbiddenError);
  });

  it("rejects an already-enrolled user", async () => {
    const repos = makeRepos({
      existingEnrollment: { id: 1, offeringId: 1, userEmail: "s@x.com", role: 0, banned: false },
    });
    const service = new EnrollmentService(repos.enrollments, repos.offerings, repos.courses, repos.users);

    await expect(service.enrollByCode("s@x.com", "ABC123")).rejects.toThrow(ConflictError);
  });

  it("rejects a user banned from the offering with a distinct error code", async () => {
    const repos = makeRepos({
      existingEnrollment: { id: 1, offeringId: 1, userEmail: "s@x.com", role: 0, banned: true },
    });
    const service = new EnrollmentService(repos.enrollments, repos.offerings, repos.courses, repos.users);

    try {
      await service.enrollByCode("s@x.com", "ABC123");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).code).toBe("banned_from_offering");
    }
  });

  it("enrolls a new student as role=0 (student)", async () => {
    const repos = makeRepos();
    const service = new EnrollmentService(repos.enrollments, repos.offerings, repos.courses, repos.users);

    const result = await service.enrollByCode("s@x.com", "abc123"); // lowercase input

    expect(repos.offerings.findByEnrollmentCode).toHaveBeenCalledWith("abc123");
    expect(repos.enrollments.create).toHaveBeenCalledWith(1, "s@x.com", 0);
    expect(result.userEmail).toBe("s@x.com");
  });
});
