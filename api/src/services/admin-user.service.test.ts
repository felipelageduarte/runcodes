import { describe, it, expect, vi } from "vitest";
import { AdminUserService } from "./admin-user.service.js";
import { NotFoundError, ConflictError, UnauthorizedError } from "../domain/errors.js";
import type { UserRepository, UserRecord } from "../repositories/user.repository.js";
import type { AuthService } from "./auth.service.js";

const USER: UserRecord = {
  email: "a@x.com",
  name: "A",
  password: "secret-hash",
  type: 0,
  universityId: 1,
  confirmed: true,
  identifier: null,
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
    updateProfile: vi.fn(),
    createByAdmin: vi.fn().mockResolvedValue(USER),
    deleteByAdmin: vi.fn().mockResolvedValue(true),
  };
}

const NEW_USER_INPUT = { email: "new@x.com", name: "New", password: "secret123", type: 0, universityId: 1 };

function makeAuth(verified = true): AuthService {
  return { verifyPassword: vi.fn().mockResolvedValue(verified) } as unknown as AuthService;
}

describe("AdminUserService.list", () => {
  it("never leaks the password hash", async () => {
    const repo = makeRepo();
    const service = new AdminUserService(repo, makeAuth());

    const result = await service.list({ page: 1, pageSize: 20 });

    expect(result.users[0]).not.toHaveProperty("password");
    expect(result.total).toBe(1);
  });
});

describe("AdminUserService.getByEmail", () => {
  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo();
    repo.findByEmail = vi.fn().mockResolvedValue(null);
    const service = new AdminUserService(repo, makeAuth());

    await expect(service.getByEmail("nobody@x.com")).rejects.toThrow(NotFoundError);
  });

  it("returns the user without the password hash", async () => {
    const repo = makeRepo();
    const service = new AdminUserService(repo, makeAuth());

    const result = await service.getByEmail("a@x.com");
    expect(result).not.toHaveProperty("password");
    expect(result.email).toBe("a@x.com");
  });
});

describe("AdminUserService.update", () => {
  it("throws NotFoundError for a missing user", async () => {
    const repo = makeRepo();
    repo.updateByAdmin = vi.fn().mockResolvedValue(null);
    const service = new AdminUserService(repo, makeAuth());

    await expect(service.update("nobody@x.com", { type: 2 })).rejects.toThrow(NotFoundError);
  });

  it("updates and returns the result without the password hash", async () => {
    const repo = makeRepo();
    const service = new AdminUserService(repo, makeAuth());

    const result = await service.update("a@x.com", { type: 2 });
    expect(result.type).toBe(2);
    expect(result).not.toHaveProperty("password");
  });
});

describe("AdminUserService.create", () => {
  it("rejects an email already registered", async () => {
    const repo = makeRepo();
    repo.existsByEmail = vi.fn().mockResolvedValue(true);
    const service = new AdminUserService(repo, makeAuth());

    await expect(service.create(NEW_USER_INPUT)).rejects.toThrow(ConflictError);
    expect(repo.createByAdmin).not.toHaveBeenCalled();
  });

  it("hashes the password and returns the result without the hash", async () => {
    const repo = makeRepo();
    repo.existsByEmail = vi.fn().mockResolvedValue(false);
    const service = new AdminUserService(repo, makeAuth());

    const result = await service.create(NEW_USER_INPUT);

    const call = (repo.createByAdmin as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.passwordHash).not.toBe("secret123");
    expect(call.passwordHash.startsWith("$2")).toBe(true);
    expect(call.email).toBe("new@x.com");
    expect(result).not.toHaveProperty("password");
  });
});

describe("AdminUserService.delete", () => {
  it("throws UnauthorizedError when the actor's password is wrong, without touching the repo", async () => {
    const repo = makeRepo();
    const auth = makeAuth(false);
    const service = new AdminUserService(repo, auth);

    await expect(service.delete("a@x.com", "admin@x.com", "wrong")).rejects.toThrow(UnauthorizedError);
    expect(repo.deleteByAdmin).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when there's no such user", async () => {
    const repo = makeRepo();
    repo.deleteByAdmin = vi.fn().mockResolvedValue(false);
    const service = new AdminUserService(repo, makeAuth());

    await expect(service.delete("nobody@x.com", "admin@x.com", "correct")).rejects.toThrow(NotFoundError);
  });

  it("deletes an existing user after verifying the actor's password", async () => {
    const repo = makeRepo();
    const auth = makeAuth(true);
    const service = new AdminUserService(repo, auth);

    await service.delete("a@x.com", "admin@x.com", "correct");
    expect(auth.verifyPassword).toHaveBeenCalledWith("admin@x.com", "correct");
    expect(repo.deleteByAdmin).toHaveBeenCalledWith("a@x.com");
  });
});
