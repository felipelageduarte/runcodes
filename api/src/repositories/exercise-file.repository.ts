import type { PrismaClient } from "@prisma/client";
import type { AttachmentRepository, AttachmentRecord } from "./attachment.repository.js";

export class PrismaExerciseFileRepository implements AttachmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listForExercise(exerciseId: number): Promise<AttachmentRecord[]> {
    const rows = await this.prisma.exercise_files.findMany({ where: { exercise_id: exerciseId } });
    return rows.map(toRecord);
  }

  async findById(id: number): Promise<AttachmentRecord | null> {
    const row = await this.prisma.exercise_files.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async create(exerciseId: number, path: string): Promise<AttachmentRecord> {
    const row = await this.prisma.exercise_files.create({ data: { exercise_id: exerciseId, path } });
    return toRecord(row);
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.exercise_files.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}

function toRecord(row: { id: number; exercise_id: number; path: string }): AttachmentRecord {
  return { id: row.id, exerciseId: row.exercise_id, path: row.path };
}
