import type { PrismaClient } from "@prisma/client";

export interface UserRecord {
  email: string;
  name: string;
  password: string;
  type: number;
  universityId: number | null;
  confirmed: boolean;
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

// Interface-first: services depend on this contract, never on PrismaClient
// directly, so the persistence technology can change without touching
// business logic (and so services are trivially mockable in tests).
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
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
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: { email: true, name: true, password: true, type: true, universityId: true, confirmed: true },
    });
    if (!row) return null;
    return { ...row, confirmed: row.confirmed ?? false };
  }

  async updatePassword(email: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { email }, data: { password: passwordHash } });
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
        select: { email: true, name: true, password: true, type: true, universityId: true, confirmed: true },
      }),
    ]);
    return { total, users: rows.map((r) => ({ ...r, confirmed: r.confirmed ?? false })) };
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
        select: { email: true, name: true, password: true, type: true, universityId: true, confirmed: true },
      });
      return { ...row, confirmed: row.confirmed ?? false };
    } catch {
      return null;
    }
  }
}
