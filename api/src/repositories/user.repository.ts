import type { PrismaClient } from "@prisma/client";
import type { SessionState, SessionStateSource, TokenVersionStore } from "../lib/session-state.js";

const USER_SELECT = {
  email: true,
  name: true,
  password: true,
  type: true,
  universityId: true,
  confirmed: true,
  identifier: true,
  token_version: true,
} as const;

type UserRow = {
  email: string;
  name: string;
  password: string;
  type: number;
  universityId: number | null;
  confirmed: boolean | null;
  identifier: string | null;
  token_version: number;
};

function toRecord(row: UserRow): UserRecord {
  const { token_version, ...rest } = row;
  return { ...rest, confirmed: row.confirmed ?? false, tokenVersion: token_version };
}

export interface UserRecord {
  email: string;
  name: string;
  password: string;
  type: number;
  universityId: number | null;
  confirmed: boolean;
  identifier: string | null;
  /** Versão da sessão (claim `tv` do JWT); ver lib/session-state.ts. */
  tokenVersion: number;
}

export interface UserConfirmationRecord {
  email: string;
  confirmed: boolean;
  confirmationTokenHash: string | null;
  confirmationTokenExpiresAt: Date | null;
}

export interface PasswordResetState {
  email: string;
  resetTokenHash: string | null;
  resetTokenExpiresAt: Date | null;
}

export interface NewUser {
  email: string;
  name: string;
  passwordHash: string;
  universityId: number | null;
  confirmationTokenHash: string;
  confirmationTokenExpiresAt: Date;
}

export interface AdminUserListFilter {
  universityId?: number | null;
  type?: number;
  confirmed?: boolean;
  nameContains?: string;
  emailContains?: string;
  page: number;
  pageSize: number;
}

export interface AdminUserPatch {
  name?: string;
  type?: number;
  confirmed?: boolean;
  universityId?: number | null;
}

export interface ProfilePatch {
  name?: string;
  universityId?: number | null;
  identifier?: string | null;
}

export interface NewUserByAdmin {
  email: string;
  name: string;
  passwordHash: string;
  type: number;
  universityId: number | null;
}

// Interface-first: services depend on this contract, never on PrismaClient
// directly, so the persistence technology can change without touching
// business logic (and so services are trivially mockable in tests).
export interface UserRepository extends SessionStateSource, TokenVersionStore {
  findByEmail(email: string): Promise<UserRecord | null>;
  /** Só o que o requireAuth confere a cada request (ver session-state.ts). */
  findSessionState(email: string): Promise<SessionState | null>;
  /** `token_version + 1`: derruba todo JWT emitido antes. */
  bumpTokenVersion(email: string): Promise<void>;
  updatePassword(email: string, passwordHash: string): Promise<void>;
  existsByEmail(email: string): Promise<boolean>;
  create(input: NewUser): Promise<void>;
  findConfirmationState(email: string): Promise<UserConfirmationRecord | null>;
  confirm(email: string): Promise<void>;
  setConfirmationToken(email: string, tokenHash: string, expiresAt: Date): Promise<void>;
  setResetToken(email: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findResetState(email: string): Promise<PasswordResetState | null>;
  /** Sets the new password and clears the reset token in one write. */
  resetPassword(email: string, passwordHash: string): Promise<void>;
  listForAdmin(filter: AdminUserListFilter): Promise<{ total: number; users: UserRecord[] }>;
  updateByAdmin(email: string, patch: AdminUserPatch): Promise<UserRecord | null>;
  /** Mirrors UsersController::insert() — admin creates an account that's
   * pre-confirmed (no email-verification round trip), unlike self-signup. */
  createByAdmin(input: NewUserByAdmin): Promise<UserRecord>;
  /** Mirrors UsersController::delete() — hard delete, cascades to
   * enrollments/commits/etc via the FK constraints already in place. */
  deleteByAdmin(email: string): Promise<boolean>;
  /** Self-service only — never `type`/`confirmed`, those stay admin-only.
   * Mirrors UsersController::profile()'s "Atualizar Dados Pessoais" path. */
  updateProfile(email: string, patch: ProfilePatch): Promise<UserRecord | null>;
  /** Unpaginated — every confirmed email in the inclusive `[minType,
   * maxType]` range (`maxType` omitted = no upper bound). Backs the admin
   * broadcast's audience resolution (mirrors Message::getRecipesList()'s
   * role buckets, see message.service.ts). */
  listConfirmedEmailsByTypeRange(minType: number, maxType?: number): Promise<string[]>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: USER_SELECT,
    });
    if (!row) return null;
    return toRecord(row);
  }

  async updatePassword(email: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { email }, data: { password: passwordHash } });
  }
  async findSessionState(email: string): Promise<SessionState | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: { type: true, confirmed: true, token_version: true },
    });
    if (!row) return null;
    return { type: row.type, confirmed: row.confirmed ?? false, tokenVersion: row.token_version };
  }

  async bumpTokenVersion(email: string): Promise<void> {
    await this.prisma.user.updateMany({ where: { email }, data: { token_version: { increment: 1 } } });
  }


  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  async create(input: NewUser): Promise<void> {
    await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        password: input.passwordHash,
        type: 0, // signup always creates a student; promotion is an admin action
        source: 0,
        confirmed: false,
        universityId: input.universityId,
        confirmation_token_hash: input.confirmationTokenHash,
        confirmation_token_expires_at: input.confirmationTokenExpiresAt,
      },
    });
  }

  async findConfirmationState(email: string): Promise<UserConfirmationRecord | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: { email: true, confirmed: true, confirmation_token_hash: true, confirmation_token_expires_at: true },
    });
    if (!row) return null;
    return {
      email: row.email,
      confirmed: row.confirmed ?? false,
      confirmationTokenHash: row.confirmation_token_hash,
      confirmationTokenExpiresAt: row.confirmation_token_expires_at,
    };
  }

  async confirm(email: string): Promise<void> {
    await this.prisma.user.update({
      where: { email },
      data: { confirmed: true, confirmation_token_hash: null, confirmation_token_expires_at: null },
    });
  }

  async setConfirmationToken(email: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { email },
      data: { confirmation_token_hash: tokenHash, confirmation_token_expires_at: expiresAt },
    });
  }

  async setResetToken(email: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { email },
      data: { reset_token_hash: tokenHash, reset_token_expires_at: expiresAt },
    });
  }

  async findResetState(email: string): Promise<PasswordResetState | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: { email: true, reset_token_hash: true, reset_token_expires_at: true },
    });
    if (!row) return null;
    return { email: row.email, resetTokenHash: row.reset_token_hash, resetTokenExpiresAt: row.reset_token_expires_at };
  }

  async resetPassword(email: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { email },
      data: { password: passwordHash, reset_token_hash: null, reset_token_expires_at: null },
    });
  }

  async listForAdmin(filter: AdminUserListFilter): Promise<{ total: number; users: UserRecord[] }> {
    const where = {
      ...(filter.universityId !== undefined ? { universityId: filter.universityId } : {}),
      ...(filter.type !== undefined ? { type: filter.type } : {}),
      ...(filter.confirmed !== undefined ? { confirmed: filter.confirmed } : {}),
      ...(filter.nameContains ? { name: { contains: filter.nameContains, mode: "insensitive" as const } } : {}),
      ...(filter.emailContains
        ? { email: { contains: filter.emailContains, mode: "insensitive" as const } }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        select: USER_SELECT,
      }),
    ]);
    return { total, users: rows.map(toRecord) };
  }

  async listConfirmedEmailsByTypeRange(minType: number, maxType?: number): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        type: { gte: minType, ...(maxType !== undefined ? { lte: maxType } : {}) },
        confirmed: true,
      },
      select: { email: true },
    });
    return rows.map((r) => r.email);
  }

  async updateByAdmin(email: string, patch: AdminUserPatch): Promise<UserRecord | null> {
    try {
      const row = await this.prisma.user.update({
        where: { email },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.confirmed !== undefined ? { confirmed: patch.confirmed } : {}),
          ...(patch.universityId !== undefined ? { universityId: patch.universityId } : {}),
        },
        select: USER_SELECT,
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }

  async createByAdmin(input: NewUserByAdmin): Promise<UserRecord> {
    const row = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        password: input.passwordHash,
        type: input.type,
        source: 0,
        confirmed: true,
        universityId: input.universityId,
      },
      select: USER_SELECT,
    });
    return toRecord(row);
  }

  async deleteByAdmin(email: string): Promise<boolean> {
    try {
      await this.prisma.user.delete({ where: { email } });
      return true;
    } catch {
      return false;
    }
  }

  async updateProfile(email: string, patch: ProfilePatch): Promise<UserRecord | null> {
    try {
      const row = await this.prisma.user.update({
        where: { email },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.universityId !== undefined ? { universityId: patch.universityId } : {}),
          ...(patch.identifier !== undefined ? { identifier: patch.identifier } : {}),
        },
        select: USER_SELECT,
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }
}
