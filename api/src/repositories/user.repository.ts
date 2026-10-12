import type { PrismaClient } from "@prisma/client";

export interface UserRecord {
  email: string;
  name: string;
  password: string;
  type: number;
  universityId: number | null;
}

// Interface-first: services depend on this contract, never on PrismaClient
// directly, so the persistence technology can change without touching
// business logic (and so services are trivially mockable in tests).
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  updatePassword(email: string, passwordHash: string): Promise<void>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { email: true, name: true, password: true, type: true, universityId: true },
    });
  }

  async updatePassword(email: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { email }, data: { password: passwordHash } });
  }
}
