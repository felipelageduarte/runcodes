import { describe, it, expect, vi } from "vitest";
import { CourseService } from "./course.service.js";
import { NotFoundError, ConflictError } from "../domain/errors.js";
import type { CourseRepository, CourseRecord } from "../repositories/course.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";

const COURSE: CourseRecord = { id: 1, code: "X", title: "X", universityId: 1 };

function makeRepos() {
  const courses: CourseRepository = {
    list: vi.fn().mockResolvedValue({ total: 1, courses: [COURSE] }),
    findById: vi.fn(),
    searchByUniversity: vi.fn().mockResolvedValue([COURSE]),
    existsByCode: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue(COURSE),
  };
  const users: UserRepository = {
    findByEmail: vi.fn(),
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
  return { courses, users };
}

describe("CourseService.getById", () => {
  it("throws NotFoundError when the course doesn't exist", async () => {
    const repos = makeRepos();
    repos.courses.findById = vi.fn().mockResolvedValue(null);
    const service = new CourseService(repos.courses, repos.users);

    await expect(service.getById(999)).rejects.toThrow(NotFoundError);
  });

  it("returns the course when found", async () => {
    const repos = makeRepos();
    repos.courses.findById = vi.fn().mockResolvedValue(COURSE);
    const service = new CourseService(repos.courses, repos.users);

    await expect(service.getById(1)).resolves.toEqual(COURSE);
  });
});

describe("CourseService.list", () => {
  it("wraps the repository result with pagination metadata", async () => {
    const repos = makeRepos();
    const service = new CourseService(repos.courses, repos.users);

    const result = await service.list({ page: 2, pageSize: 10 });

    expect(result).toEqual({ total: 1, page: 2, pageSize: 10, courses: [COURSE] });
  });
});

describe("CourseService.searchForUser", () => {
  it("returns an empty list when the user has no university", async () => {
    const repos = makeRepos();
    repos.users.findByEmail = vi.fn().mockResolvedValue({
      email: "p@x.com",
      name: "P",
      password: "",
      type: 2,
      universityId: null,
      confirmed: true,
    });
    const service = new CourseService(repos.courses, repos.users);

    await expect(service.searchForUser("p@x.com")).resolves.toEqual([]);
    expect(repos.courses.searchByUniversity).not.toHaveBeenCalled();
  });

  it("scopes the search to the user's own university", async () => {
    const repos = makeRepos();
    repos.users.findByEmail = vi.fn().mockResolvedValue({
      email: "p@x.com",
      name: "P",
      password: "",
      type: 2,
      universityId: 7,
      confirmed: true,
    });
    const service = new CourseService(repos.courses, repos.users);

    await service.searchForUser("p@x.com", "algo");

    expect(repos.courses.searchByUniversity).toHaveBeenCalledWith(7, "algo");
  });
});

describe("CourseService.create", () => {
  it("creates the course when the code isn't taken at that university", async () => {
    const repos = makeRepos();
    const service = new CourseService(repos.courses, repos.users);

    await service.create({ code: "X", title: "X", universityId: 1 });

    expect(repos.courses.create).toHaveBeenCalledWith({ code: "X", title: "X", universityId: 1 });
  });

  it("throws ConflictError when the code is already taken at that university", async () => {
    const repos = makeRepos();
    repos.courses.existsByCode = vi.fn().mockResolvedValue(true);
    const service = new CourseService(repos.courses, repos.users);

    await expect(service.create({ code: "X", title: "X", universityId: 1 })).rejects.toThrow(ConflictError);
    expect(repos.courses.create).not.toHaveBeenCalled();
  });
});
