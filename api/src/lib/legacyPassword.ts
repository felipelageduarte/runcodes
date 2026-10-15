import { createHash } from "node:crypto";

/**
 * Matches CakePHP 2.x AuthComponent::password(): sha1(Security.salt + password).
 * Needed only to verify logins against rows not yet rehashed to bcrypt.
 * Pure function — the salt is a parameter, not a module-level env read, so
 * callers (and their tests) control it explicitly.
 */
export function hashLegacyPassword(salt: string, plain: string): string {
  return createHash("sha1").update(salt + plain).digest("hex");
}

export function isLegacyHash(stored: string): boolean {
  return stored.length === 40;
}
