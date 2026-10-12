import type { PrismaClient } from "@prisma/client";

export interface UniversityRecord {
  id: number;
  abbreviation: string;
  name: string;
  studentIdentifierText: string | null;
}

export interface UniversityRepository {
  findByIds(ids: number[]): Promise<Map<number, UniversityRecord>>;
}

export class PrismaUniversityRepository implements UniversityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIds(ids: number[]): Promise<Map<number, UniversityRecord>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.universities.findMany({ where: { id: { in: ids } } });
    return new Map(
      rows.map((r) => [
        r.id,
        {
          id: r.id,
          abbreviation: r.abbreviation,
          name: r.name,
          studentIdentifierText: r.student_identifier_text,
        },
      ]),
    );
  }
}
