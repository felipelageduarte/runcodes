import type { PrismaClient } from "@prisma/client";

export interface UniversityRecord {
  id: number;
  abbreviation: string;
  name: string;
  studentIdentifierText: string | null;
  type: number | null;
  state: string | null;
}

export interface NewUniversity {
  abbreviation: string;
  name: string;
  studentIdentifierText: string | null;
  type: number | null;
  state: string | null;
}

export interface UniversityPatch {
  abbreviation?: string;
  name?: string;
  studentIdentifierText?: string | null;
  type?: number | null;
  state?: string | null;
}

export interface UniversityRepository {
  findByIds(ids: number[]): Promise<Map<number, UniversityRecord>>;
  findById(id: number): Promise<UniversityRecord | null>;
  list(): Promise<UniversityRecord[]>;
  existsByAbbreviation(abbreviation: string): Promise<boolean>;
  create(input: NewUniversity): Promise<UniversityRecord>;
  update(id: number, patch: UniversityPatch): Promise<UniversityRecord | null>;
}

export class PrismaUniversityRepository implements UniversityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIds(ids: number[]): Promise<Map<number, UniversityRecord>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.universities.findMany({ where: { id: { in: ids } } });
    return new Map(rows.map((r) => [r.id, toRecord(r)]));
  }

  async findById(id: number): Promise<UniversityRecord | null> {
    const row = await this.prisma.universities.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async list(): Promise<UniversityRecord[]> {
    const rows = await this.prisma.universities.findMany({ orderBy: { name: "asc" } });
    return rows.map(toRecord);
  }

  async existsByAbbreviation(abbreviation: string): Promise<boolean> {
    const count = await this.prisma.universities.count({ where: { abbreviation } });
    return count > 0;
  }

  async create(input: NewUniversity): Promise<UniversityRecord> {
    const row = await this.prisma.universities.create({
      data: {
        abbreviation: input.abbreviation,
        name: input.name,
        student_identifier_text: input.studentIdentifierText,
        type: input.type,
        state: input.state,
      },
    });
    return toRecord(row);
  }

  async update(id: number, patch: UniversityPatch): Promise<UniversityRecord | null> {
    try {
      const row = await this.prisma.universities.update({
        where: { id },
        data: {
          ...(patch.abbreviation !== undefined ? { abbreviation: patch.abbreviation } : {}),
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.studentIdentifierText !== undefined
            ? { student_identifier_text: patch.studentIdentifierText }
            : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.state !== undefined ? { state: patch.state } : {}),
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
  abbreviation: string;
  name: string;
  student_identifier_text: string | null;
  type: number | null;
  state: string | null;
}): UniversityRecord {
  return {
    id: row.id,
    abbreviation: row.abbreviation,
    name: row.name,
    studentIdentifierText: row.student_identifier_text,
    type: row.type,
    state: row.state,
  };
}
