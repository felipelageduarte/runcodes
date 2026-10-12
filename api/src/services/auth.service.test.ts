import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service.js";
import { UnauthorizedError } from "../domain/errors.js";
import { hashLegacyPassword } from "../lib/legacyPassword.js";
import type { UserRepository, UserRecord } from "../repositories/user.repository.js";

const SALT = "test-salt";

function makeUsersRepo(user: UserRecord | null): UserRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(user),
    updatePassword: vi.fn().mockResolvedValue(undefined),
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
    const user: UserRecord = {
      email: "a@example.com",
      name: "A",
      password: legacyHash,
      type: 0,
      universityId: 1,
    };
    const users = makeUsersRepo(user);
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
    const user: UserRecord = {
      email: "a@example.com",
      name: "A",
      password: legacyHash,
      type: 0,
      universityId: 1,
    };
    const users = makeUsersRepo(user);
    const auth = new AuthService(users, "secret", "1h", SALT);

    await expect(auth.login("a@example.com", "wrong")).rejects.toThrow(UnauthorizedError);
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it("accepts an already-migrated bcrypt hash and does not rehash again", async () => {
    const bcryptHash = await bcrypt.hash("correct horse", 4);
    const user: UserRecord = {
      email: "a@example.com",
      name: "A",
      password: bcryptHash,
      type: 0,
      universityId: 1,
    };
    const users = makeUsersRepo(user);
    const auth = new AuthService(users, "secret", "1h", SALT);

    const result = await auth.login("a@example.com", "correct horse");

    expect(result.user.email).toBe("a@example.com");
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it("rejects a wrong password against a bcrypt hash", async () => {
    const bcryptHash = await bcrypt.hash("correct horse", 4);
    const user: UserRecord = {
      email: "a@example.com",
      name: "A",
      password: bcryptHash,
      type: 0,
      universityId: 1,
    };
    const users = makeUsersRepo(user);
    const auth = new AuthService(users, "secret", "1h", SALT);

    await expect(auth.login("a@example.com", "wrong")).rejects.toThrow(UnauthorizedError);
  });
});
