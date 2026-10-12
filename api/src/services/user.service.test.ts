import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { UserService } from "./user.service.js";
import { ConflictError, ValidationError, NotFoundError } from "../domain/errors.js";
import type { UserRepository, UserConfirmationRecord } from "../repositories/user.repository.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function makeRepo(confirmationState: UserConfirmationRecord | null = null): UserRepository {
  return {
    findByEmail: vi.fn(),
    updatePassword: vi.fn(),
    existsByEmail: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue(undefined),
    findConfirmationState: vi.fn().mockResolvedValue(confirmationState),
    confirm: vi.fn().mockResolvedValue(undefined),
  };
}

describe("UserService.signup", () => {
  it("rejects an email already registered", async () => {
    const repo = makeRepo();
    repo.existsByEmail = vi.fn().mockResolvedValue(true);
    const service = new UserService(repo);

    await expect(
      service.signup({ email: "a@x.com", name: "A", password: "secret123", universityId: 1 }),
    ).rejects.toThrow(ConflictError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("creates the user with a hashed password and returns a confirmation token", async () => {
    const repo = makeRepo();
    const service = new UserService(repo);

    const result = await service.signup({
      email: "a@x.com",
      name: "A",
      password: "secret123",
      universityId: 1,
    });

    expect(result.confirmationToken).toMatch(/^[0-9a-f]{64}$/);
    expect(repo.create).toHaveBeenCalledTimes(1);
    const input = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(input.passwordHash).not.toBe("secret123");
    expect(input.passwordHash.startsWith("$2")).toBe(true);
    expect(input.confirmationTokenHash).toBe(hashToken(result.confirmationToken));
    expect(input.confirmationTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("UserService.confirm", () => {
  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo(null);
    const service = new UserService(repo);

    await expect(service.confirm("nobody@x.com", "token")).rejects.toThrow(NotFoundError);
  });

  it("is a no-op when already confirmed", async () => {
    const repo = makeRepo({
      email: "a@x.com",
      confirmed: true,
      confirmationTokenHash: null,
      confirmationTokenExpiresAt: null,
    });
    const service = new UserService(repo);

    await service.confirm("a@x.com", "whatever");
    expect(repo.confirm).not.toHaveBeenCalled();
  });

  it("rejects when there's no pending confirmation", async () => {
    const repo = makeRepo({
      email: "a@x.com",
      confirmed: false,
      confirmationTokenHash: null,
      confirmationTokenExpiresAt: null,
    });
    const service = new UserService(repo);

    await expect(service.confirm("a@x.com", "token")).rejects.toThrow(ValidationError);
  });

  it("rejects an expired token", async () => {
    const repo = makeRepo({
      email: "a@x.com",
      confirmed: false,
      confirmationTokenHash: hashToken("tok"),
      confirmationTokenExpiresAt: new Date(Date.now() - 1000),
    });
    const service = new UserService(repo);

    const promise = service.confirm("a@x.com", "tok");
    await expect(promise).rejects.toMatchObject({ code: "confirmation_token_expired" });
  });

  it("rejects a wrong token", async () => {
    const repo = makeRepo({
      email: "a@x.com",
      confirmed: false,
      confirmationTokenHash: hashToken("tok"),
      confirmationTokenExpiresAt: new Date(Date.now() + 1000),
    });
    const service = new UserService(repo);

    const promise = service.confirm("a@x.com", "wrong-token");
    await expect(promise).rejects.toMatchObject({ code: "invalid_confirmation_token" });
  });

  it("confirms with a valid, unexpired token", async () => {
    const repo = makeRepo({
      email: "a@x.com",
      confirmed: false,
      confirmationTokenHash: hashToken("tok"),
      confirmationTokenExpiresAt: new Date(Date.now() + 1000),
    });
    const service = new UserService(repo);

    await service.confirm("a@x.com", "tok");
    expect(repo.confirm).toHaveBeenCalledWith("a@x.com");
  });
});
