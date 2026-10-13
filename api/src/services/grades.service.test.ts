import { describe, it, expect, vi } from "vitest";
import { GradesService } from "./grades.service.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { OfferingRepository, OfferingRecord } from "../repositories/offering.repository.js";
import type { ExerciseRepository, ExerciseRecord } from "../repositories/exercise.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { CommitRepository, CommitRecord } from "../repositories/commit.repository.js";
import type { CourseRepository, CourseRecord } from "../repositories/course.repository.js";
import type { UniversityRepository, UniversityRecord } from "../repositories/university.repository.js";
import { UserType } from "../lib/constants.js";

const COURSE: CourseRecord = { id: 1, code: "MAC0101", title: "Intro", universityId: 1 };
const UNIVERSITY: UniversityRecord = {
  id: 1,
  abbreviation: "USP",
  name: "USP",
  studentIdentifierText: "NUSP",
  type: 0,
  state: "SP",
};

const OFFERING: OfferingRecord = {
  id: 1,
  courseId: 1,
  year: 2026,
  term: 1,
  classroom: "A",
  endDate: new Date("2099-01-01"),
  enrollmentCode: null,
  maxStudents: 0,
  maxExercises: 0,
};

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
    awsKey: "key",
    ip: null,
    ...overrides,
  };
}

function makeRepos(overrides: { offering?: OfferingRecord | null; isStaff?: boolean } = {}) {
  const offerings: OfferingRepository = {
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue("offering" in overrides ? overrides.offering : OFFERING),
    findByIds: vi.fn(),
    findByEnrollmentCode: vi.fn(),
  };
  const exercises: ExerciseRepository = {
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([]),
    findGhosts: vi.fn().mockResolvedValue([]),
    list: vi.fn(),
    listVisible: vi.fn().mockResolvedValue([EXERCISE]),
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
    listStudentsForOffering: vi.fn().mockResolvedValue([
      { email: "alice@x.com", name: "Alice", identifier: "111" },
      { email: "bob@x.com", name: "Bob", identifier: "222" },
    ]),
  };
  const commits: CommitRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    listForUserOnExercise: vi.fn(),
    listLatestPerStudentForExercise: vi.fn().mockResolvedValue([makeCommit()]), // only alice submitted
    listLatestForUserAcrossExercises: vi.fn().mockResolvedValue([]),
  };
  const courses: CourseRepository = {
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(COURSE),
    searchByUniversity: vi.fn(),
  };
  const universities: UniversityRepository = {
    findByIds: vi.fn(),
    findById: vi.fn().mockResolvedValue(UNIVERSITY),
    list: vi.fn(),
    existsByAbbreviation: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  return { offerings, exercises, enrollments, commits, courses, universities };
}

function buildService(repos: ReturnType<typeof makeRepos>) {
  return new GradesService(
    repos.offerings,
    repos.exercises,
    repos.enrollments,
    repos.commits,
    repos.courses,
    repos.universities,
  );
}

const STAFF = { email: "prof@x.com", type: 0 };
const STUDENT = { email: "alice@x.com", type: 0 };
const ADMIN = { email: "admin@x.com", type: UserType.ADMIN };

describe("GradesService.getGrades", () => {
  it("throws NotFoundError for a missing offering", async () => {
    const repos = makeRepos({ offering: null });
    const service = buildService(repos);

    await expect(service.getGrades(1, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff, non-admin requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.getGrades(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("allows an admin without an enrollment check", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.getGrades(1, ADMIN)).resolves.toBeDefined();
    expect(repos.enrollments.isStaff).not.toHaveBeenCalled();
  });

  it("builds a student x exercise grade matrix, defaulting to null for students who haven't submitted", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const result = await service.getGrades(1, STAFF);

    expect(result.students.map((s) => s.email)).toEqual(["alice@x.com", "bob@x.com"]);
    expect(result.exercises).toHaveLength(1);
    const [exerciseGrades] = result.exercises;
    expect(exerciseGrades.exerciseId).toBe(10);
    expect(exerciseGrades.grades).toEqual([
      { studentEmail: "alice@x.com", score: "10", status: 5, commitId: 1 },
      { studentEmail: "bob@x.com", score: null, status: null, commitId: null },
    ]);
  });

  it("includes unopened exercises (full picture for staff, not the student-facing visibility rule)", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    await service.getGrades(1, STAFF);

    expect(repos.exercises.listVisible).toHaveBeenCalledWith({ offeringId: 1, includeUnopened: true });
  });
});

describe("GradesService.exportCsv", () => {
  it("builds a CSV with the university's identifier label as a header, defaulting missing grades to 0.0", async () => {
    const repos = makeRepos();
    const service = buildService(repos);

    const { filename, csv } = await service.exportCsv(1, STAFF);

    expect(filename).toBe("grades-MAC0101-1.csv");
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("Name,NUSP,Email,Role,Ex");
    expect(lines[1]).toBe("Alice,111,alice@x.com,Student,10");
    expect(lines[2]).toBe("Bob,222,bob@x.com,Student,0");
  });

  it("falls back to a generic label when the university has none", async () => {
    const repos = makeRepos();
    repos.universities.findById = vi.fn().mockResolvedValue({ ...UNIVERSITY, studentIdentifierText: null });
    const service = buildService(repos);

    const { csv } = await service.exportCsv(1, STAFF);

    expect(csv.split("\r\n")[0]).toBe("Name,Identifier,Email,Role,Ex");
  });

  it("throws NotFoundError for a missing offering", async () => {
    const repos = makeRepos({ offering: null });
    const service = buildService(repos);

    await expect(service.exportCsv(1, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("is forbidden for a non-staff, non-admin requester", async () => {
    const repos = makeRepos({ isStaff: false });
    const service = buildService(repos);

    await expect(service.exportCsv(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });
});
