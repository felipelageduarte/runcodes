import { describe, it, expect, vi } from "vitest";
import { OfferingService } from "./offering.service.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { OfferingRepository, OfferingRecord } from "../repositories/offering.repository.js";
import type { CourseRepository, CourseRecord } from "../repositories/course.repository.js";
import type { UniversityRepository } from "../repositories/university.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { ExerciseRepository } from "../repositories/exercise.repository.js";
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
    findByEnrollmentCode: vi.fn(),
  };
  const courses: CourseRepository = {
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(COURSE),
    searchByUniversity: vi.fn(),
  };
  const universities: UniversityRepository = {
    findByIds: vi.fn().mockResolvedValue(new Map()),
  };
  const enrollments: EnrollmentRepository = {
    isEnrolled: vi.fn().mockResolvedValue(false),
    isStaff: vi.fn().mockResolvedValue(false),
    findOne: vi.fn(),
    listForUser: vi.fn().mockResolvedValue([1]),
    listRecordsForUser: vi.fn(),
    listStaffForOfferings: vi.fn().mockResolvedValue(new Map()),
    create: vi.fn(),
  };
  const exercises: ExerciseRepository = {
    findById: vi.fn(),
    list: vi.fn(),
    listVisible: vi.fn().mockResolvedValue([]),
    countCases: vi.fn(),
    findAllowedExtensions: vi.fn(),
  };
  return { offerings, courses, universities, enrollments, exercises };
}

function buildService(repos: ReturnType<typeof makeRepos>) {
  return new OfferingService(
    repos.offerings,
    repos.courses,
    repos.universities,
    repos.enrollments,
    repos.exercises,
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
