import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { UserRepository } from "../repositories/user.repository.js";
import { hashLegacyPassword, isLegacyHash } from "../lib/legacyPassword.js";
import { UnauthorizedError, ForbiddenError, ValidationError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";
import { tokenVersionOf, type SessionTokenPayload } from "../http/middleware/requireAuth.js";

/** Janela em que um token já expirado ainda pode ser trocado por um novo
 * em POST /api/auth/refresh (o cookie de sessão dura 7 dias; o JWT, 1 h).
 * Dentro dela a renovação exige `tv` igual ao do banco e conta confirmada;
 * fora dela, login de novo. */
export const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  email: string;
  name: string;
  type: number;
  /** Non-null while impersonating a lower role via "view as" — carries
   * the account's real type so the UI can show a permanent indicator
   * and a way back. Null for an ordinary session. */
  viewAs: { active: true; realType: number } | null;
}

export interface AuthTokens {
  token: string;
  user: SessionUser;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwtSecret: string,
    private readonly jwtExpiresIn: string,
    private readonly legacyPasswordSalt: string,
  ) {}

  private sign(user: { email: string; tokenVersion: number }, type: number, realType?: number): string {
    const claims: Omit<SessionTokenPayload, "sub"> & { tv: number } = { type, tv: user.tokenVersion };
    if (realType !== undefined) claims.realType = realType;
    return jwt.sign(claims, this.jwtSecret, {
      subject: user.email,
      expiresIn: this.jwtExpiresIn as jwt.SignOptions["expiresIn"],
    });
  }

  /** Shared by login and any reauthentication flow (e.g. confirming a
   * destructive admin action) — same legacy-sha1-vs-bcrypt check, no
   * token minted, no rehash (callers that log the user in handle that
   * themselves). */
  async verifyPassword(email: string, password: string): Promise<boolean> {
    const user = await this.users.findByEmail(email);
    if (!user) return false;
    return isLegacyHash(user.password)
      ? hashLegacyPassword(this.legacyPasswordSalt, password) === user.password
      : bcrypt.compare(password, user.password);
  }

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
    // A rehash não incrementa token_version: é a mesma senha, não uma troca.
    if (isLegacyHash(user.password)) {
      const rehashed = await bcrypt.hash(password, 12);
      await this.users.updatePassword(email, rehashed);
    }

    const token = this.sign(user, user.type);
    return { token, user: { email: user.email, name: user.name, type: user.type, viewAs: null } };
  }

  /** Backs GET /api/auth/me — session rehydration on page load, since the
   * httpOnly cookie carries only a signed JWT (email + type + optional
   * realType), never the display name the UI needs. `requester` is the
   * decoded token as requireAuth already parsed it, so viewAs reflects
   * the live session without a second trip through the token. */
  async me(requester: Requester): Promise<SessionUser | null> {
    const user = await this.users.findByEmail(requester.email);
    if (!user) return null;
    return {
      email: user.email,
      name: user.name,
      type: requester.type,
      viewAs: requester.realType !== undefined ? { active: true, realType: requester.realType } : null,
    };
  }

  /** Mirrors the legacy Users::viewAs() in spirit (same account, role
   * seen by the UI rebaixado) but adds what the legacy never had: this
   * is a NEW signed token, not a session-mutation on the server, and
   * every switch is audit-logged for free by the cross-cutting
   * auditLog middleware (any authenticated POST already gets one line —
   * see http/middleware/auditLog.ts). The ceiling is always the
   * account's REAL type, even through a chain of switches — a second
   * view-as call while already downgraded can't use the already-lowered
   * `requester.type` as its ceiling, or re-calling view-as would let you
   * ratchet partway back up by targeting something between your current
   * downgraded type and your real one, then again — it must stay capped
   * at `requester.realType`. */
  async viewAs(requester: Requester, targetType: number): Promise<AuthTokens> {
    const realType = requester.realType ?? requester.type;
    if (!Number.isInteger(targetType) || targetType < 0) {
      throw new ValidationError("Invalid type", "invalid_type");
    }
    if (targetType >= realType) {
      throw new ForbiddenError("View-as can only downgrade, never match or elevate your real role", "cannot_elevate");
    }

    const user = await this.users.findByEmail(requester.email);
    if (!user) throw new UnauthorizedError("Invalid credentials", "invalid_credentials");

    const token = this.sign(user, targetType, realType);
    return {
      token,
      user: { email: user.email, name: user.name, type: targetType, viewAs: { active: true, realType } },
    };
  }

  /** Returns to the real role — mints an ordinary token with no
   * `realType` claim, same as a fresh login. */
  async stopViewAs(requester: Requester): Promise<AuthTokens> {
    if (requester.realType === undefined) {
      throw new ValidationError("Not currently viewing as another role", "not_viewing_as");
    }

    const user = await this.users.findByEmail(requester.email);
    if (!user) throw new UnauthorizedError("Invalid credentials", "invalid_credentials");

    const token = this.sign(user, requester.realType);
    return { token, user: { email: user.email, name: user.name, type: requester.realType, viewAs: null } };
  }

  /** Backs POST /api/auth/refresh. Aceita o token corrente mesmo expirado
   * (dentro de REFRESH_WINDOW_MS desde a expiração), relê o usuário e só
   * emite um novo se `tv` bate com o banco e a conta segue confirmada —
   * é aqui que a revogação por token_version pega quem tinha token antigo.
   * Preserva o view-as (papel pedido, limitado pelo papel real atual). */
  async refresh(rawToken: string): Promise<AuthTokens> {
    let payload: SessionTokenPayload & { exp?: number };
    try {
      payload = jwt.verify(rawToken, this.jwtSecret, { ignoreExpiration: true }) as typeof payload;
    } catch {
      throw new UnauthorizedError("Invalid token", "invalid_token");
    }
    const expiredAt = (payload.exp ?? 0) * 1000;
    if (!payload.exp || Date.now() - expiredAt > REFRESH_WINDOW_MS) {
      throw new UnauthorizedError("Session expired", "session_expired");
    }

    const user = await this.users.findByEmail(payload.sub);
    if (!user) throw new UnauthorizedError("Invalid token", "invalid_token");
    if (user.tokenVersion !== tokenVersionOf(payload)) {
      throw new UnauthorizedError("Session revoked", "session_revoked");
    }
    if (!user.confirmed) throw new ForbiddenError("Account email not confirmed yet", "account_not_confirmed");

    const viewingAs = payload.realType !== undefined && payload.type < user.type;
    const type = viewingAs ? payload.type : user.type;
    const token = this.sign(user, type, viewingAs ? user.type : undefined);
    return {
      token,
      user: {
        email: user.email,
        name: user.name,
        type,
        viewAs: viewingAs ? { active: true, realType: user.type } : null,
      },
    };
  }
}
