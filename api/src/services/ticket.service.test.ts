import { describe, it, expect, vi } from "vitest";
import { TicketService } from "./ticket.service.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { TicketRepository, TicketRecord } from "../repositories/ticket.repository.js";
import { UserType } from "../lib/constants.js";

const TICKET: TicketRecord = {
  id: 1,
  userEmail: "student@x.com",
  datetime: new Date(),
  type: 0,
  status: 0,
  solved: false,
  priority: 2,
  message: "help",
};

function makeRepo(): TicketRepository {
  return {
    create: vi.fn().mockResolvedValue(TICKET),
    findById: vi.fn().mockResolvedValue(TICKET),
    list: vi.fn().mockResolvedValue({ total: 1, tickets: [TICKET] }),
    listForUser: vi.fn().mockResolvedValue([TICKET]),
    update: vi.fn().mockResolvedValue({ ...TICKET, message: "updated" }),
    setSolved: vi.fn().mockResolvedValue({ ...TICKET, solved: true }),
    setStatus: vi.fn().mockResolvedValue({ ...TICKET, status: 1 }),
    delete: vi.fn().mockResolvedValue(true),
  };
}

const STUDENT = { email: "student@x.com", type: 0 };
const ASSISTANT = { email: "a@x.com", type: UserType.ASSISTANT };
const OTHER_STUDENT = { email: "other@x.com", type: 0 };

describe("TicketService.create", () => {
  it("allows any authenticated user", async () => {
    const repo = makeRepo();
    const service = new TicketService(repo);

    await service.create(STUDENT, { type: 0, priority: 2, message: "help" });
    expect(repo.create).toHaveBeenCalledWith({
      userEmail: STUDENT.email,
      type: 0,
      priority: 2,
      message: "help",
    });
  });
});

describe("TicketService.list", () => {
  it("is forbidden for a plain student", async () => {
    const repo = makeRepo();
    const service = new TicketService(repo);

    await expect(service.list({ page: 1, pageSize: 20 }, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("allows assistant+", async () => {
    const repo = makeRepo();
    const service = new TicketService(repo);

    await expect(service.list({ page: 1, pageSize: 20 }, ASSISTANT)).resolves.toMatchObject({ total: 1 });
  });
});

describe("TicketService.getById", () => {
  it("throws NotFoundError for a missing ticket", async () => {
    const repo = makeRepo();
    repo.findById = vi.fn().mockResolvedValue(null);
    const service = new TicketService(repo);

    await expect(service.getById(1, STUDENT)).rejects.toThrow(NotFoundError);
  });

  it("allows the ticket's own author even as a plain student", async () => {
    const repo = makeRepo();
    const service = new TicketService(repo);

    await expect(service.getById(1, STUDENT)).resolves.toEqual(TICKET);
  });

  it("is forbidden for a different student", async () => {
    const repo = makeRepo();
    const service = new TicketService(repo);

    await expect(service.getById(1, OTHER_STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("allows assistant+ to view someone else's ticket", async () => {
    const repo = makeRepo();
    const service = new TicketService(repo);

    await expect(service.getById(1, ASSISTANT)).resolves.toEqual(TICKET);
  });
});

describe("TicketService.setSolved/close/delete", () => {
  it("are forbidden for a plain student", async () => {
    const repo = makeRepo();
    const service = new TicketService(repo);

    await expect(service.setSolved(1, STUDENT)).rejects.toThrow(ForbiddenError);
    await expect(service.close(1, STUDENT)).rejects.toThrow(ForbiddenError);
    await expect(service.delete(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });

  it("work for assistant+", async () => {
    const repo = makeRepo();
    const service = new TicketService(repo);

    await expect(service.setSolved(1, ASSISTANT)).resolves.toMatchObject({ solved: true });
    await expect(service.close(1, ASSISTANT)).resolves.toMatchObject({ status: 1 });
    await expect(service.delete(1, ASSISTANT)).resolves.toBeUndefined();
  });
});
