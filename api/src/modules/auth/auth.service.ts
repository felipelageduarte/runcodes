import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../lib/env.js";
import { hashLegacyPassword, isLegacyHash } from "../../lib/legacyPassword.js";

export class InvalidCredentialsError extends Error {}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new InvalidCredentialsError();

  const valid = isLegacyHash(user.password)
    ? hashLegacyPassword(password) === user.password
    : await bcrypt.compare(password, user.password);

  if (!valid) throw new InvalidCredentialsError();

  if (isLegacyHash(user.password)) {
    const rehashed = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { email }, data: { password: rehashed } });
  }

  const token = jwt.sign({ sub: user.email, type: user.type }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

  return { token, user: { email: user.email, name: user.name, type: user.type } };
}
