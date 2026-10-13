import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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
    identifier: null,
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

describe("AuthService.me", () => {
  it("returns null for an unknown email (e.g. deleted after the token was issued)", async () => {
    const users = makeUsersRepo(null);
    const auth = new AuthService(users, "secret", "1h", SALT);

    await expect(auth.me({ email: "gone@example.com", type: 0 })).resolves.toBeNull();
  });

  it("returns email/name/type without the password hash, viewAs null for an ordinary session", async () => {
    const users = makeUsersRepo(makeUser({ email: "a@example.com", name: "A", type: 2 }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    await expect(auth.me({ email: "a@example.com", type: 2 })).resolves.toEqual({
      email: "a@example.com",
      name: "A",
      type: 2,
      viewAs: null,
    });
  });

  it("reflects the downgraded type and active viewAs when the requester carries a realType", async () => {
    const users = makeUsersRepo(makeUser({ email: "a@example.com", name: "A", type: 3 }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    await expect(auth.me({ email: "a@example.com", type: 0, realType: 3 })).resolves.toEqual({
      email: "a@example.com",
      name: "A",
      type: 0,
      viewAs: { active: true, realType: 3 },
    });
  });
});

describe("AuthService.viewAs", () => {
  it("issues a token with the downgraded type and the real type as a separate claim", async () => {
    const users = makeUsersRepo(makeUser({ email: "admin@x.com", type: 3 }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    const result = await auth.viewAs({ email: "admin@x.com", type: 3 }, 0);

    expect(result.user).toMatchObject({ type: 0, viewAs: { active: true, realType: 3 } });
    const decoded = jwt.verify(result.token, "secret") as { sub: string; type: number; realType?: number };
    expect(decoded).toMatchObject({ sub: "admin@x.com", type: 0, realType: 3 });
  });

  it("rejects a target type equal to the real type (no-op elevation attempt)", async () => {
    const users = makeUsersRepo(makeUser({ email: "admin@x.com", type: 3 }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    await expect(auth.viewAs({ email: "admin@x.com", type: 3 }, 3)).rejects.toMatchObject({
      code: "cannot_elevate",
    });
  });

  it("rejects a target type above the real type", async () => {
    const users = makeUsersRepo(makeUser({ email: "prof@x.com", type: 2 }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    await expect(auth.viewAs({ email: "prof@x.com", type: 2 }, 3)).rejects.toMatchObject({
      code: "cannot_elevate",
    });
  });

  it("caps at the REAL type even when already viewing as something lower (no ratcheting back up through a chain)", async () => {
    const users = makeUsersRepo(makeUser({ email: "admin@x.com", type: 3 }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    // Already downgraded to type 0 (student), real type 3 (admin) carried
    // in the token. Asking for type 2 must be allowed (still < realType 3)
    // even though 2 > current type 0 — the ceiling is the REAL type, not
    // whatever the current downgraded type happens to be.
    const result = await auth.viewAs({ email: "admin@x.com", type: 0, realType: 3 }, 2);
    expect(result.user).toMatchObject({ type: 2, viewAs: { active: true, realType: 3 } });

    // But asking for 3 (the real type itself) or anything above is still forbidden.
    await expect(
      auth.viewAs({ email: "admin@x.com", type: 0, realType: 3 }, 3),
    ).rejects.toMatchObject({ code: "cannot_elevate" });
  });
});

describe("AuthService.stopViewAs", () => {
  it("returns an ordinary token at the real type, with no realType claim", async () => {
    const users = makeUsersRepo(makeUser({ email: "admin@x.com", type: 3 }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    const result = await auth.stopViewAs({ email: "admin@x.com", type: 0, realType: 3 });

    expect(result.user).toEqual({ email: "admin@x.com", name: expect.any(String), type: 3, viewAs: null });
    const decoded = jwt.verify(result.token, "secret") as { sub: string; type: number; realType?: number };
    expect(decoded.realType).toBeUndefined();
    expect(decoded.type).toBe(3);
  });

  it("throws when not currently viewing as anyone", async () => {
    const users = makeUsersRepo(makeUser({ email: "a@example.com", type: 0 }));
    const auth = new AuthService(users, "secret", "1h", SALT);

    await expect(auth.stopViewAs({ email: "a@example.com", type: 0 })).rejects.toMatchObject({
      code: "not_viewing_as",
    });
  });
});
