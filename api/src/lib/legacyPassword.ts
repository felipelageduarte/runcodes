import { createHash } from "node:crypto";
import { env } from "./env.js";

/**
 * Matches CakePHP 2.x AuthComponent::password(): sha1(Security.salt + password).
 * Needed only to verify logins against rows not yet rehashed to bcrypt.
 */
export function hashLegacyPassword(plain: string): string {
  return createHash("sha1").update(env.LEGACY_PASSWORD_SALT + plain).digest("hex");
}

export function isLegacyHash(stored: string): boolean {
  return stored.length === 40;
}
