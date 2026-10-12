import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { UserRepository } from "../repositories/user.repository.js";
import { hashLegacyPassword, isLegacyHash } from "../lib/legacyPassword.js";
import { UnauthorizedError, ForbiddenError } from "../domain/errors.js";

export interface AuthTokens {
  token: string;
  user: { email: string; name: string; type: number };
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwtSecret: string,
    private readonly jwtExpiresIn: string,
    private readonly legacyPasswordSalt: string,
  ) {}

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedError("Invalid credentials", "invalid_credentials");

    const valid = isLegacyHash(user.password)
      ? hashLegacyPassword(this.legacyPasswordSalt, password) === user.password
      : await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedError("Invalid credentials", "invalid_credentials");

    // Checked after the password (not via a query-level filter like the
    // legacy CakePHP Auth scope) so a wrong password always reads as
    // "invalid_credentials" — this distinct message only reaches someone
    // who already proved they know the password.
    if (!user.confirmed) {
      throw new ForbiddenError("Account email not confirmed yet", "account_not_confirmed");
    }

    // Transparent migration: once a legacy sha1 hash is verified, replace
    // it with bcrypt so every subsequent login skips the legacy path.
    if (isLegacyHash(user.password)) {
      const rehashed = await bcrypt.hash(password, 12);
      await this.users.updatePassword(email, rehashed);
    }

    const token = jwt.sign({ sub: user.email, type: user.type }, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn as jwt.SignOptions["expiresIn"],
    });
    return { token, user: { email: user.email, name: user.name, type: user.type } };
  }

  /** Backs GET /api/auth/me — session rehydration on page load, since the
   * httpOnly cookie carries only a signed JWT (email + type), never the
   * display name the UI needs. */
  async me(email: string): Promise<{ email: string; name: string; type: number } | null> {
    const user = await this.users.findByEmail(email);
    if (!user) return null;
    return { email: user.email, name: user.name, type: user.type };
  }
}
