import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { UserService } from "./user.service.js";
import bcrypt from "bcryptjs";
import { ConflictError, ValidationError, NotFoundError, UnauthorizedError } from "../domain/errors.js";
import type {
  UserRepository,
  UserConfirmationRecord,
  PasswordResetState,
  UserRecord,
} from "../repositories/user.repository.js";
import type { EmailSender } from "../repositories/email-sender.js";
import { hashLegacyPassword } from "../lib/legacyPassword.js";

const APP_BASE_URL = "http://localhost:5173";
const SALT = "test-salt";

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
    updateProfile: vi.fn(),
  };
}

function makeEmailSender(): EmailSender {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

function extractToken(emailSender: EmailSender): string {
  const call = (emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
  const match = /token=([0-9a-f]{64})/.exec(call.text);
  if (!match) throw new Error(`no token found in email text: ${call.text}`);
  return match[1];
}

describe("UserService.signup", () => {
  it("rejects an email already registered", async () => {
    const repo = makeRepo();
    repo.existsByEmail = vi.fn().mockResolvedValue(true);
    const emailSender = makeEmailSender();
    const service = new UserService(repo, emailSender, APP_BASE_URL, SALT);

    await expect(
      service.signup({ email: "a@x.com", name: "A", password: "secret123", universityId: 1 }),
    ).rejects.toThrow(ConflictError);
    expect(repo.create).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("creates the user with a hashed password and emails a confirmation link", async () => {
    const repo = makeRepo();
    const emailSender = makeEmailSender();
    const service = new UserService(repo, emailSender, APP_BASE_URL, SALT);

    await service.signup({
      email: "a@x.com",
      name: "A",
      password: "secret123",
      universityId: 1,
    });

    expect(repo.create).toHaveBeenCalledTimes(1);
    const input = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(input.passwordHash).not.toBe("secret123");
    expect(input.passwordHash.startsWith("$2")).toBe(true);
    expect(input.confirmationTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(emailSender.send).toHaveBeenCalledTimes(1);
    const confirmationToken = extractToken(emailSender);
    expect(input.confirmationTokenHash).toBe(hashToken(confirmationToken));
    const message = (emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(message.to).toBe("a@x.com");
    expect(message.text).toContain(`${APP_BASE_URL}/confirm?email=a%40x.com&token=${confirmationToken}`);
  });
});

describe("UserService.confirm", () => {
  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo(null);
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    await expect(service.confirm("nobody@x.com", "token")).rejects.toThrow(NotFoundError);
  });

  it("is a no-op when already confirmed", async () => {
    const repo = makeRepo({
      email: "a@x.com",
      confirmed: true,
      confirmationTokenHash: null,
      confirmationTokenExpiresAt: null,
    });
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

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
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    await expect(service.confirm("a@x.com", "token")).rejects.toThrow(ValidationError);
  });

  it("rejects an expired token", async () => {
    const repo = makeRepo({
      email: "a@x.com",
      confirmed: false,
      confirmationTokenHash: hashToken("tok"),
      confirmationTokenExpiresAt: new Date(Date.now() - 1000),
    });
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

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
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

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
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    await service.confirm("a@x.com", "tok");
    expect(repo.confirm).toHaveBeenCalledWith("a@x.com");
  });
});

describe("UserService.resendConfirmation", () => {
  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo(null);
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    await expect(service.resendConfirmation("nobody@x.com")).rejects.toThrow(NotFoundError);
  });

  it("rejects an already-confirmed account", async () => {
    const repo = makeRepo({
      email: "a@x.com",
      confirmed: true,
      confirmationTokenHash: null,
      confirmationTokenExpiresAt: null,
    });
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    const promise = service.resendConfirmation("a@x.com");
    await expect(promise).rejects.toMatchObject({ code: "already_confirmed" });
  });

  it("issues a fresh token and emails it for an unconfirmed account", async () => {
    const repo = makeRepo({
      email: "a@x.com",
      confirmed: false,
      confirmationTokenHash: hashToken("old-token"),
      confirmationTokenExpiresAt: new Date(Date.now() - 1000), // even expired, resend still works
    });
    const emailSender = makeEmailSender();
    const service = new UserService(repo, emailSender, APP_BASE_URL, SALT);

    await service.resendConfirmation("a@x.com");

    expect(emailSender.send).toHaveBeenCalledTimes(1);
    const confirmationToken = extractToken(emailSender);
    expect(repo.setConfirmationToken).toHaveBeenCalledWith(
      "a@x.com",
      hashToken(confirmationToken),
      expect.any(Date),
    );
  });
});

describe("UserService.requestPasswordReset", () => {
  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo();
    repo.existsByEmail = vi.fn().mockResolvedValue(false);
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    await expect(service.requestPasswordReset("nobody@x.com")).rejects.toThrow(NotFoundError);
  });

  it("issues a reset token and emails it for a known user", async () => {
    const repo = makeRepo();
    repo.existsByEmail = vi.fn().mockResolvedValue(true);
    const emailSender = makeEmailSender();
    const service = new UserService(repo, emailSender, APP_BASE_URL, SALT);

    await service.requestPasswordReset("a@x.com");

    expect(emailSender.send).toHaveBeenCalledTimes(1);
    const resetToken = extractToken(emailSender);
    expect(repo.setResetToken).toHaveBeenCalledWith("a@x.com", hashToken(resetToken), expect.any(Date));
    const message = (emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(message.text).toContain(`${APP_BASE_URL}/reset-password?email=a%40x.com&token=${resetToken}`);
  });
});

describe("UserService.resetPassword", () => {
  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo(null, null);
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    await expect(service.resetPassword("nobody@x.com", "tok", "newpassword1")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("rejects when there's no pending reset", async () => {
    const repo = makeRepo(null, { email: "a@x.com", resetTokenHash: null, resetTokenExpiresAt: null });
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    const promise = service.resetPassword("a@x.com", "tok", "newpassword1");
    await expect(promise).rejects.toMatchObject({ code: "no_pending_reset" });
  });

  it("rejects an expired token", async () => {
    const repo = makeRepo(null, {
      email: "a@x.com",
      resetTokenHash: hashToken("tok"),
      resetTokenExpiresAt: new Date(Date.now() - 1000),
    });
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    const promise = service.resetPassword("a@x.com", "tok", "newpassword1");
    await expect(promise).rejects.toMatchObject({ code: "reset_token_expired" });
  });

  it("rejects a wrong token", async () => {
    const repo = makeRepo(null, {
      email: "a@x.com",
      resetTokenHash: hashToken("tok"),
      resetTokenExpiresAt: new Date(Date.now() + 1000),
    });
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    const promise = service.resetPassword("a@x.com", "wrong", "newpassword1");
    await expect(promise).rejects.toMatchObject({ code: "invalid_reset_token" });
  });

  it("sets a hashed new password with a valid token", async () => {
    const repo = makeRepo(null, {
      email: "a@x.com",
      resetTokenHash: hashToken("tok"),
      resetTokenExpiresAt: new Date(Date.now() + 1000),
    });
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    await service.resetPassword("a@x.com", "tok", "newpassword1");

    expect(repo.resetPassword).toHaveBeenCalledTimes(1);
    const [email, passwordHash] = (repo.resetPassword as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(email).toBe("a@x.com");
    expect(passwordHash).not.toBe("newpassword1");
    expect(passwordHash.startsWith("$2")).toBe(true);
  });
});

function makeUserRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    email: "a@x.com",
    name: "A",
    password: "",
    type: 0,
    universityId: 1,
    confirmed: true,
    identifier: null,
    ...overrides,
  };
}

describe("UserService.getProfile", () => {
  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo();
    repo.findByEmail = vi.fn().mockResolvedValue(null);
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    await expect(service.getProfile("nobody@x.com")).rejects.toThrow(NotFoundError);
  });

  it("omits the password hash from the returned profile", async () => {
    const repo = makeRepo();
    repo.findByEmail = vi.fn().mockResolvedValue(makeUserRecord({ password: "secret-hash" }));
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    const profile = await service.getProfile("a@x.com");

    expect(profile).not.toHaveProperty("password");
    expect(profile.email).toBe("a@x.com");
  });
});

describe("UserService.updateProfile", () => {
  it("throws NotFoundError when the repository finds nothing to update", async () => {
    const repo = makeRepo();
    repo.updateProfile = vi.fn().mockResolvedValue(null);
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    await expect(
      service.updateProfile("nobody@x.com", { name: "New Name" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("passes the patch through and omits the password from the result", async () => {
    const repo = makeRepo();
    repo.updateProfile = vi.fn().mockResolvedValue(makeUserRecord({ name: "New Name", password: "hash" }));
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    const result = await service.updateProfile("a@x.com", { name: "New Name", identifier: "12345" });

    expect(repo.updateProfile).toHaveBeenCalledWith("a@x.com", { name: "New Name", identifier: "12345" });
    expect(result).not.toHaveProperty("password");
    expect(result.name).toBe("New Name");
  });
});

describe("UserService.changePassword", () => {
  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo();
    repo.findByEmail = vi.fn().mockResolvedValue(null);
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    await expect(service.changePassword("nobody@x.com", "old", "newpassword1")).rejects.toThrow(NotFoundError);
  });

  it("rejects a wrong current bcrypt password", async () => {
    const repo = makeRepo();
    const currentHash = await bcrypt.hash("correct-password", 12);
    repo.findByEmail = vi.fn().mockResolvedValue(makeUserRecord({ password: currentHash }));
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    const promise = service.changePassword("a@x.com", "wrong-password", "newpassword1");
    await expect(promise).rejects.toThrow(UnauthorizedError);
    await expect(promise).rejects.toMatchObject({ code: "invalid_current_password" });
    expect(repo.updatePassword).not.toHaveBeenCalled();
  });

  it("sets a new bcrypt-hashed password when the current bcrypt password is correct", async () => {
    const repo = makeRepo();
    const currentHash = await bcrypt.hash("correct-password", 12);
    repo.findByEmail = vi.fn().mockResolvedValue(makeUserRecord({ password: currentHash }));
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    await service.changePassword("a@x.com", "correct-password", "newpassword1");

    const [email, passwordHash] = (repo.updatePassword as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(email).toBe("a@x.com");
    expect(passwordHash.startsWith("$2")).toBe(true);
  });

  it("accepts the current password via the legacy sha1 hash too", async () => {
    const repo = makeRepo();
    const legacyHash = hashLegacyPassword(SALT, "correct horse");
    repo.findByEmail = vi.fn().mockResolvedValue(makeUserRecord({ password: legacyHash }));
    const service = new UserService(repo, makeEmailSender(), APP_BASE_URL, SALT);

    await service.changePassword("a@x.com", "correct horse", "newpassword1");

    expect(repo.updatePassword).toHaveBeenCalledTimes(1);
  });
});
