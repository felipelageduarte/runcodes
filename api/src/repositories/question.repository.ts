import type { PrismaClient } from "@prisma/client";

export interface QuestionRecord {
  id: number;
  title: string | null;
  text: string | null;
  tags: string | null;
}

export interface NewQuestion {
  title: string;
  text: string;
  tags: string | null;
}

export interface QuestionPatch {
  title?: string;
  text?: string;
  tags?: string | null;
}

/** Mirrors QuestionsController — a small FAQ/knowledge-base catalog.
 * Reading is public in the legacy app (Auth->allow('modal')); kept the
 * same shape here (GET routes have no requireAuth). */
export interface QuestionRepository {
  list(page: number, pageSize: number): Promise<{ total: number; questions: QuestionRecord[] }>;
  findById(id: number): Promise<QuestionRecord | null>;
  create(input: NewQuestion): Promise<QuestionRecord>;
  update(id: number, patch: QuestionPatch): Promise<QuestionRecord | null>;
  delete(id: number): Promise<boolean>;
}

export class PrismaQuestionRepository implements QuestionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(page: number, pageSize: number) {
    const [total, rows] = await Promise.all([
      this.prisma.questions.count(),
      this.prisma.questions.findMany({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: "asc" } }),
    ]);
    return { total, questions: rows };
  }

  async findById(id: number): Promise<QuestionRecord | null> {
    return this.prisma.questions.findUnique({ where: { id } });
  }

  async create(input: NewQuestion): Promise<QuestionRecord> {
    return this.prisma.questions.create({ data: input });
  }

  async update(id: number, patch: QuestionPatch): Promise<QuestionRecord | null> {
    try {
      return await this.prisma.questions.update({ where: { id }, data: patch });
    } catch {
      return null;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.questions.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
