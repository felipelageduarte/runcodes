import { apiFetch } from "./http";

export type BroadcastAudience = "students" | "staff" | "admins" | "all";

export interface MessageRecord {
  id: number;
  senderEmail: string | null;
  recipes: string | null;
  subject: string | null;
  message: string | null;
  sentAt: string;
  recipientCount: number;
}

export interface BroadcastInput {
  audience: BroadcastAudience;
  subject: string;
  message: string;
}

/** Admin-only — manda email em massa pra um grupo de usuários. Sem
 * rastreio de abertura nem blacklist, decisão deliberada (ver
 * docs/backend/admin-and-support.md). */
export function sendBroadcast(input: BroadcastInput): Promise<MessageRecord> {
  return apiFetch("/messages", { method: "POST", body: JSON.stringify(input) });
}

export function listBroadcasts(
  page = 1,
  pageSize = 20,
): Promise<{ total: number; page: number; pageSize: number; messages: MessageRecord[] }> {
  return apiFetch(`/messages?page=${page}&pageSize=${pageSize}`);
}
