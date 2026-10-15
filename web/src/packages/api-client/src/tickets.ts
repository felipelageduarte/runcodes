import { apiFetch } from "./http";

export const TicketStatus = { OPEN: 0, CLOSED: 1 } as const;

export interface TicketRecord {
  id: number;
  userEmail: string;
  datetime: string;
  type: number;
  status: number;
  solved: boolean | null;
  priority: number;
  message: string;
}

export interface NewTicketInput {
  type: number;
  priority: number;
  message: string;
}

export function createTicket(input: NewTicketInput): Promise<TicketRecord> {
  return apiFetch("/tickets", { method: "POST", body: JSON.stringify(input) });
}

export function listMyTickets(): Promise<TicketRecord[]> {
  return apiFetch("/tickets/mine");
}

/** Fila — assistant+ (checado por tipo global da conta, fila é única
 * pro sistema todo, não por turma). */
export function listTickets(
  filter: { status?: number; page?: number; pageSize?: number } = {},
): Promise<{ total: number; page: number; pageSize: number; tickets: TicketRecord[] }> {
  const qs = new URLSearchParams();
  if (filter.status !== undefined) qs.set("status", String(filter.status));
  qs.set("page", String(filter.page ?? 1));
  qs.set("pageSize", String(filter.pageSize ?? 20));
  return apiFetch(`/tickets?${qs.toString()}`);
}

export function getTicket(id: number): Promise<TicketRecord> {
  return apiFetch(`/tickets/${id}`);
}

export interface TicketPatch {
  type?: number;
  priority?: number;
  message?: string;
}

/** Não existe thread de resposta no backend — "editar" sobrescreve o
 * campo message, não anexa uma nova mensagem (ver docs/frontend/
 * roadmap.md Fase 5, gap documentado). */
export function updateTicket(id: number, patch: TicketPatch): Promise<TicketRecord> {
  return apiFetch(`/tickets/${id}`, { method: "PUT", body: JSON.stringify(patch) });
}

export function solveTicket(id: number): Promise<TicketRecord> {
  return apiFetch(`/tickets/${id}/solve`, { method: "PUT" });
}

export function closeTicket(id: number): Promise<TicketRecord> {
  return apiFetch(`/tickets/${id}/close`, { method: "PUT" });
}

export function deleteTicket(id: number): Promise<void> {
  return apiFetch(`/tickets/${id}`, { method: "DELETE" });
}
