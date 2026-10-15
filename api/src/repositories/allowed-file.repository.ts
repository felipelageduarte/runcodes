import type { PrismaClient } from "@prisma/client";

export interface AllowedFileRecord {
  id: number;
  name: string;
  extension: string;
  compilable: boolean | null;
  compileCommand: string | null;
  runCommand: string | null;
  available: boolean | null;
}

export interface NewAllowedFile {
  name: string;
  extension: string;
  compilable: boolean;
  compileCommand: string | null;
  runCommand: string | null;
}

export interface AllowedFilePatch {
  name?: string;
  extension?: string;
  compilable?: boolean;
  compileCommand?: string | null;
  runCommand?: string | null;
  available?: boolean;
}

export interface AllowedFileRepository {
  list(opts?: { compilable?: boolean; includeUnavailable?: boolean }): Promise<AllowedFileRecord[]>;
  findById(id: number): Promise<AllowedFileRecord | null>;
  findByIds(ids: number[]): Promise<AllowedFileRecord[]>;
  create(input: NewAllowedFile): Promise<AllowedFileRecord>;
  update(id: number, patch: AllowedFilePatch): Promise<AllowedFileRecord | null>;
}

export class PrismaAllowedFileRepository implements AllowedFileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(
    opts: { compilable?: boolean; includeUnavailable?: boolean } = {},
  ): Promise<AllowedFileRecord[]> {
    const rows = await this.prisma.allowed_files.findMany({
      where: {
        ...(opts.includeUnavailable ? {} : { available: true }),
        ...(opts.compilable !== undefined ? { compilable: opts.compilable } : {}),
      },
      orderBy: { name: "asc" },
    });
    return rows.map(toRecord);
  }

  async findById(id: number): Promise<AllowedFileRecord | null> {
    const row = await this.prisma.allowed_files.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findByIds(ids: number[]): Promise<AllowedFileRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.allowed_files.findMany({ where: { id: { in: ids } } });
    return rows.map(toRecord);
  }

  async create(input: NewAllowedFile): Promise<AllowedFileRecord> {
    const row = await this.prisma.allowed_files.create({
      data: {
        name: input.name,
        extension: input.extension,
        compilable: input.compilable,
        compile_command: input.compileCommand,
        run_command: input.runCommand,
        available: true,
      },
    });
    return toRecord(row);
  }

  async update(id: number, patch: AllowedFilePatch): Promise<AllowedFileRecord | null> {
    try {
      const row = await this.prisma.allowed_files.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.extension !== undefined ? { extension: patch.extension } : {}),
          ...(patch.compilable !== undefined ? { compilable: patch.compilable } : {}),
          ...(patch.compileCommand !== undefined ? { compile_command: patch.compileCommand } : {}),
          ...(patch.runCommand !== undefined ? { run_command: patch.runCommand } : {}),
          ...(patch.available !== undefined ? { available: patch.available } : {}),
        },
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }
}

function toRecord(row: {
  id: number;
  name: string;
  extension: string;
  compilable: boolean | null;
  compile_command: string | null;
  run_command: string | null;
  available: boolean | null;
}): AllowedFileRecord {
  return {
    id: row.id,
    name: row.name,
    extension: row.extension,
    compilable: row.compilable,
    compileCommand: row.compile_command,
    runCommand: row.run_command,
    available: row.available,
  };
}
