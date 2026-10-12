import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { UserService } from "./user.service.js";
import { ConflictError, ValidationError, NotFoundError } from "../domain/errors.js";
import type {
  UserRepository,
  UserConfirmationRecord,
  PasswordResetState,
} from "../repositories/user.repository.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function makeRepo(
  confirmationState: UserConfirmationRecord | null = null,
  resetState: PasswordResetState | null = null,
): UserRepository {
  return {
    findByEmail: vi.fn(),
    updatePassword: vi.fn(),
    existsByEmail: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue(undefined),
    findConfirmationState: vi.fn().mockResolvedValue(confirmationState),
    confirm: vi.fn().mockResolvedValue(undefined),
    setConfirmationToken: vi.fn().mockResolvedValue(undefined),
    setResetToken: vi.fn().mockResolvedValue(undefined),
    findResetState: vi.fn().mockResolvedValue(resetState),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    listForAdmin: vi.fn(),
    updateByAdmin: vi.fn(),
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

describe("UserService.resendConfirmation", () => {
  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo(null);
    const service = new UserService(repo);

    await expect(service.resendConfirmation("nobody@x.com")).rejects.toThrow(NotFoundError);
  });

  it("rejects an already-confirmed account", async () => {
    const repo = makeRepo({
      email: "a@x.com",
      confirmed: true,
      confirmationTokenHash: null,
      confirmationTokenExpiresAt: null,
    });
    const service = new UserService(repo);

    const promise = service.resendConfirmation("a@x.com");
    await expect(promise).rejects.toMatchObject({ code: "already_confirmed" });
  });

  it("issues a fresh token for an unconfirmed account", async () => {
    const repo = makeRepo({
      email: "a@x.com",
      confirmed: false,
      confirmationTokenHash: hashToken("old-token"),
      confirmationTokenExpiresAt: new Date(Date.now() - 1000), // even expired, resend still works
    });
    const service = new UserService(repo);

    const result = await service.resendConfirmation("a@x.com");

    expect(result.confirmationToken).toMatch(/^[0-9a-f]{64}$/);
    expect(repo.setConfirmationToken).toHaveBeenCalledWith(
      "a@x.com",
      hashToken(result.confirmationToken),
      expect.any(Date),
    );
  });
});

describe("UserService.requestPasswordReset", () => {
  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo();
    repo.existsByEmail = vi.fn().mockResolvedValue(false);
    const service = new UserService(repo);

    await expect(service.requestPasswordReset("nobody@x.com")).rejects.toThrow(NotFoundError);
  });

  it("issues a reset token for a known user", async () => {
    const repo = makeRepo();
    repo.existsByEmail = vi.fn().mockResolvedValue(true);
    const service = new UserService(repo);

    const result = await service.requestPasswordReset("a@x.com");

    expect(result.resetToken).toMatch(/^[0-9a-f]{64}$/);
    expect(repo.setResetToken).toHaveBeenCalledWith(
      "a@x.com",
      hashToken(result.resetToken),
      expect.any(Date),
    );
  });
});

describe("UserService.resetPassword", () => {
  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo(null, null);
    const service = new UserService(repo);

    await expect(service.resetPassword("nobody@x.com", "tok", "newpassword1")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("rejects when there's no pending reset", async () => {
    const repo = makeRepo(null, { email: "a@x.com", resetTokenHash: null, resetTokenExpiresAt: null });
    const service = new UserService(repo);

    const promise = service.resetPassword("a@x.com", "tok", "newpassword1");
    await expect(promise).rejects.toMatchObject({ code: "no_pending_reset" });
  });

  it("rejects an expired token", async () => {
    const repo = makeRepo(null, {
      email: "a@x.com",
      resetTokenHash: hashToken("tok"),
      resetTokenExpiresAt: new Date(Date.now() - 1000),
    });
    const service = new UserService(repo);

    const promise = service.resetPassword("a@x.com", "tok", "newpassword1");
    await expect(promise).rejects.toMatchObject({ code: "reset_token_expired" });
  });

  it("rejects a wrong token", async () => {
    const repo = makeRepo(null, {
      email: "a@x.com",
      resetTokenHash: hashToken("tok"),
      resetTokenExpiresAt: new Date(Date.now() + 1000),
    });
    const service = new UserService(repo);

    const promise = service.resetPassword("a@x.com", "wrong", "newpassword1");
    await expect(promise).rejects.toMatchObject({ code: "invalid_reset_token" });
  });

  it("sets a hashed new password with a valid token", async () => {
    const repo = makeRepo(null, {
      email: "a@x.com",
      resetTokenHash: hashToken("tok"),
      resetTokenExpiresAt: new Date(Date.now() + 1000),
    });
    const service = new UserService(repo);

    await service.resetPassword("a@x.com", "tok", "newpassword1");

    expect(repo.resetPassword).toHaveBeenCalledTimes(1);
    const [email, passwordHash] = (repo.resetPassword as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(email).toBe("a@x.com");
    expect(passwordHash).not.toBe("newpassword1");
    expect(passwordHash.startsWith("$2")).toBe(true);
  });
});
