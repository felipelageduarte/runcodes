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

export interface NewUser {
  email: string;
  name: string;
  passwordHash: string;
  universityId: number | null;
  confirmationTokenHash: string;
  confirmationTokenExpiresAt: Date;
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
}
