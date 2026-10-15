import type {
  TicketRepository,
  TicketRecord,
  TicketListFilter,
  TicketPatch,
} from "../repositories/ticket.repository.js";
import { TicketStatus } from "../repositories/ticket.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

export interface NewTicketInput {
  type: number;
  priority: number;
  message: string;
}

/** Mirrors TicketsController. Any authenticated user can file a ticket;
 * managing the (global, not per-turma) queue requires assistant+
 * (type >= ASSISTANT), matching the legacy isAuthorized() exactly. */
export class TicketService {
  constructor(private readonly tickets: TicketRepository) {}

  private requireStaff(requester: Requester): void {
    if (requester.type < UserType.ASSISTANT) throw new ForbiddenError();
  }

  create(requester: Requester, input: NewTicketInput): Promise<TicketRecord> {
    return this.tickets.create({ userEmail: requester.email, ...input });
  }

  /** Not in the legacy controller — a self-service "my tickets" view so a
   * student who filed one has somewhere to check its status. */
  listMine(requester: Requester): Promise<TicketRecord[]> {
    return this.tickets.listForUser(requester.email);
  }

  async list(filter: TicketListFilter, requester: Requester) {
    this.requireStaff(requester);
    const { total, tickets } = await this.tickets.list(filter);
    return { total, page: filter.page, pageSize: filter.pageSize, tickets };
  }

  async getById(id: number, requester: Requester): Promise<TicketRecord> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) throw new NotFoundError("Ticket not found");
    if (ticket.userEmail !== requester.email) this.requireStaff(requester);
    return ticket;
  }

  async update(id: number, patch: TicketPatch, requester: Requester): Promise<TicketRecord> {
    this.requireStaff(requester);
    const updated = await this.tickets.update(id, patch);
    if (!updated) throw new NotFoundError("Ticket not found");
    return updated;
  }

  async setSolved(id: number, requester: Requester): Promise<TicketRecord> {
    this.requireStaff(requester);
    const updated = await this.tickets.setSolved(id, true);
    if (!updated) throw new NotFoundError("Ticket not found");
    return updated;
  }

  async close(id: number, requester: Requester): Promise<TicketRecord> {
    this.requireStaff(requester);
    const updated = await this.tickets.setStatus(id, TicketStatus.CLOSED);
    if (!updated) throw new NotFoundError("Ticket not found");
    return updated;
  }

  async delete(id: number, requester: Requester): Promise<void> {
    this.requireStaff(requester);
    if (!(await this.tickets.delete(id))) throw new NotFoundError("Ticket not found");
  }
}
