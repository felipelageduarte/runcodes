import { randomBytes, createHash } from "node:crypto";

/** Token de uso único enviado por e-mail (confirmação, convite, reset):
 * só o hash vai ao banco. */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
