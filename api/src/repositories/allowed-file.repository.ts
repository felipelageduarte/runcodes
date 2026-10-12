import type { PrismaClient } from "@prisma/client";

export interface AllowedFileRecord {
  id: number;
  name: string;
  extension: string;
  compilable: boolean | null;
  available: boolean | null;
}

export interface AllowedFileRepository {
  list(compilable?: boolean): Promise<AllowedFileRecord[]>;
  findByIds(ids: number[]): Promise<AllowedFileRecord[]>;
}

export class PrismaAllowedFileRepository implements AllowedFileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(compilable?: boolean): Promise<AllowedFileRecord[]> {
    return this.prisma.allowed_files.findMany({
      where: { available: true, ...(compilable !== undefined ? { compilable } : {}) },
      orderBy: { name: "asc" },
    });
  }

  async findByIds(ids: number[]): Promise<AllowedFileRecord[]> {
    if (ids.length === 0) return [];
    return this.prisma.allowed_files.findMany({ where: { id: { in: ids } } });
  }
}
