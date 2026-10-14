import type { PrismaClient } from "@prisma/client";

export interface MessageRecord {
  id: number;
  senderEmail: string | null;
  recipes: string | null;
  subject: string | null;
  message: string | null;
  sentAt: Date;
  recipientCount: number;
}

export interface NewMessage {
  senderEmail: string;
  recipes: string;
  subject: string;
  message: string;
  recipientCount: number;
}

export interface MessageRepository {
  create(input: NewMessage): Promise<MessageRecord>;
  list(page: number, pageSize: number): Promise<{ total: number; messages: MessageRecord[] }>;
}

export class PrismaMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: NewMessage): Promise<MessageRecord> {
    const row = await this.prisma.messages.create({
      data: {
        sender_email: input.senderEmail,
        recipes: input.recipes,
        subject: input.subject,
        message: input.message,
        recipient_count: input.recipientCount,
      },
    });
    return toRecord(row);
  }

  async list(page: number, pageSize: number) {
    const [total, rows] = await Promise.all([
      this.prisma.messages.count(),
      this.prisma.messages.findMany({
        orderBy: { sent_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, messages: rows.map(toRecord) };
  }
}

function toRecord(row: {
  id: number;
  sender_email: string | null;
  recipes: string | null;
  subject: string | null;
  message: string | null;
  sent_at: Date;
  recipient_count: number;
}): MessageRecord {
  return {
    id: row.id,
    senderEmail: row.sender_email,
    recipes: row.recipes,
    subject: row.subject,
    message: row.message,
    sentAt: row.sent_at,
    recipientCount: row.recipient_count,
  };
}
