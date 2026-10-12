import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service.js";
import { UnauthorizedError, ForbiddenError } from "../domain/errors.js";
import { hashLegacyPassword } from "../lib/legacyPassword.js";
import type { UserRepository, UserRecord } from "../repositories/user.repository.js";

const SALT = "test-salt";

function makeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    email: "a@example.com",
    name: "A",
    password: "",
    type: 0,
    universityId: 1,
    confirmed: true,
    ...overrides,
  };
}

function makeUsersRepo(user: UserRecord | null): UserRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(user),
    updatePassword: vi.fn().mockResolvedValue(undefined),
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
}

describe("AuthService.login", () => {
  it("rejects an unknown email", async () => {
    const users = makeUsersRepo(null);
    const auth = new AuthService(users, "secret", "1h", SALT);

    await expect(auth.login("nobody@example.com", "x")).rejects.toThrow(UnauthorizedError);
  });

  it("accepts a legacy sha1 hash and transparently rehashes it to bcrypt", async () => {
    const legacyHash = hashLegacyPassword(SALT, "correct horse");
    const users = makeUsersRepo(makeUser({ password: legacyHash }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    const result = await auth.login("a@example.com", "correct horse");

    expect(result.user.email).toBe("a@example.com");
    expect(result.token).toBeTruthy();
    expect(users.updatePassword).toHaveBeenCalledTimes(1);
    const [, newHash] = (users.updatePassword as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(newHash.startsWith("$2")).toBe(true); // bcrypt prefix
  });

  it("rejects a wrong password against a legacy hash without rehashing", async () => {
    const legacyHash = hashLegacyPassword(SALT, "correct horse");
    const users = makeUsersRepo(makeUser({ password: legacyHash }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    await expect(auth.login("a@example.com", "wrong")).rejects.toThrow(UnauthorizedError);
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it("accepts an already-migrated bcrypt hash and does not rehash again", async () => {
    const bcryptHash = await bcrypt.hash("correct horse", 4);
    const users = makeUsersRepo(makeUser({ password: bcryptHash }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    const result = await auth.login("a@example.com", "correct horse");

    expect(result.user.email).toBe("a@example.com");
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it("rejects a wrong password against a bcrypt hash", async () => {
    const bcryptHash = await bcrypt.hash("correct horse", 4);
    const users = makeUsersRepo(makeUser({ password: bcryptHash }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    await expect(auth.login("a@example.com", "wrong")).rejects.toThrow(UnauthorizedError);
  });

  it("rejects a correct password for an unconfirmed account", async () => {
    const bcryptHash = await bcrypt.hash("correct horse", 4);
    const users = makeUsersRepo(makeUser({ password: bcryptHash, confirmed: false }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    const promise = auth.login("a@example.com", "correct horse");
    await expect(promise).rejects.toThrow(ForbiddenError);
    await expect(promise).rejects.toMatchObject({ code: "account_not_confirmed" });
  });

  it("reports a wrong password as invalid_credentials even when unconfirmed (doesn't leak confirmation state)", async () => {
    const bcryptHash = await bcrypt.hash("correct horse", 4);
    const users = makeUsersRepo(makeUser({ password: bcryptHash, confirmed: false }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    await expect(auth.login("a@example.com", "wrong")).rejects.toMatchObject({
      code: "invalid_credentials",
    });
  });
});
