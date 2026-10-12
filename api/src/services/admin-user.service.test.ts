import { describe, it, expect, vi } from "vitest";
import { AdminUserService } from "./admin-user.service.js";
import { NotFoundError } from "../domain/errors.js";
import type { UserRepository, UserRecord } from "../repositories/user.repository.js";

const USER: UserRecord = {
  email: "a@x.com",
  name: "A",
  password: "secret-hash",
  type: 0,
  universityId: 1,
  confirmed: true,
};

function makeRepo(): UserRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(USER),
    updatePassword: vi.fn(),
    existsByEmail: vi.fn(),
    create: vi.fn(),
    findConfirmationState: vi.fn(),
    confirm: vi.fn(),
    setConfirmationToken: vi.fn(),
    setResetToken: vi.fn(),
    findResetState: vi.fn(),
    resetPassword: vi.fn(),
    listForAdmin: vi.fn().mockResolvedValue({ total: 1, users: [USER] }),
    updateByAdmin: vi.fn().mockResolvedValue({ ...USER, type: 2 }),
  };
}

describe("AdminUserService.list", () => {
  it("never leaks the password hash", async () => {
    const repo = makeRepo();
    const service = new AdminUserService(repo);

    const result = await service.list({ page: 1, pageSize: 20 });

    expect(result.users[0]).not.toHaveProperty("password");
    expect(result.total).toBe(1);
  });
});

describe("AdminUserService.getByEmail", () => {
  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo();
    repo.findByEmail = vi.fn().mockResolvedValue(null);
    const service = new AdminUserService(repo);

    await expect(service.getByEmail("nobody@x.com")).rejects.toThrow(NotFoundError);
  });

  it("returns the user without the password hash", async () => {
    const repo = makeRepo();
    const service = new AdminUserService(repo);

    const result = await service.getByEmail("a@x.com");
    expect(result).not.toHaveProperty("password");
    expect(result.email).toBe("a@x.com");
  });
});

describe("AdminUserService.update", () => {
  it("throws NotFoundError for a missing user", async () => {
    const repo = makeRepo();
    repo.updateByAdmin = vi.fn().mockResolvedValue(null);
    const service = new AdminUserService(repo);

    await expect(service.update("nobody@x.com", { type: 2 })).rejects.toThrow(NotFoundError);
  });

  it("updates and returns the result without the password hash", async () => {
    const repo = makeRepo();
    const service = new AdminUserService(repo);

    const result = await service.update("a@x.com", { type: 2 });
    expect(result.type).toBe(2);
    expect(result).not.toHaveProperty("password");
  });
});
