import { describe, it, expect, vi } from "vitest";
import { MessageService } from "./message.service.js";
import { ForbiddenError, ValidationError } from "../domain/errors.js";
import type { MessageRepository, MessageRecord } from "../repositories/message.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import type { EmailSender } from "../repositories/email-sender.js";
import { UserType } from "../lib/constants.js";

const MESSAGE: MessageRecord = {
  id: 1,
  senderEmail: "admin@x.com",
  recipes: "Alunos",
  subject: "Oi",
  message: "Mensagem",
  sentAt: new Date(),
  recipientCount: 2,
};

function makeRepos() {
  const messages: MessageRepository = {
    create: vi.fn().mockResolvedValue(MESSAGE),
    list: vi.fn().mockResolvedValue({ total: 1, messages: [MESSAGE] }),
  };
  const users: UserRepository = {
    findByEmail: vi.fn(),
    updatePassword: vi.fn(),
    existsByEmail: vi.fn(),
    create: vi.fn(),
    findConfirmationState: vi.fn(),
    confirm: vi.fn(),
    setConfirmationToken: vi.fn(),
    setResetToken: vi.fn(),
    findResetState: vi.fn(),
    resetPassword: vi.fn(),
    listForAdmin: vi.fn(),
    updateByAdmin: vi.fn(),
    listConfirmedEmailsByTypeRange: vi.fn().mockResolvedValue(["a@x.com", "b@x.com"]),
  };
  const emailSender: EmailSender = { send: vi.fn().mockResolvedValue(undefined) };
  return { messages, users, emailSender };
}

const ADMIN = { email: "admin@x.com", type: UserType.ADMIN };
const PROFESSOR = { email: "prof@x.com", type: UserType.PROFESSOR };

describe("MessageService.send", () => {
  it("rejects a non-admin requester", async () => {
    const repos = makeRepos();
    const service = new MessageService(repos.messages, repos.users, repos.emailSender);

    await expect(
      service.send(PROFESSOR, { audience: "students", subject: "Oi", message: "Msg" }),
    ).rejects.toThrow(ForbiddenError);
    expect(repos.users.listConfirmedEmailsByTypeRange).not.toHaveBeenCalled();
  });

  it("rejects an empty subject or message", async () => {
    const repos = makeRepos();
    const service = new MessageService(repos.messages, repos.users, repos.emailSender);

    await expect(
      service.send(ADMIN, { audience: "students", subject: "  ", message: "Msg" }),
    ).rejects.toThrow(ValidationError);
  });

  it("resolves the audience to a confirmed-email type range and emails each one", async () => {
    const repos = makeRepos();
    const service = new MessageService(repos.messages, repos.users, repos.emailSender);

    await service.send(ADMIN, { audience: "staff", subject: "Manutenção", message: "Ficará fora do ar" });

    expect(repos.users.listConfirmedEmailsByTypeRange).toHaveBeenCalledWith(UserType.ASSISTANT, UserType.ADMIN - 1);
    expect(repos.emailSender.send).toHaveBeenCalledTimes(2);
    expect(repos.emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@x.com", subject: "[run.codes] Manutenção" }),
    );
  });

  it("resolves 'students' to an exact-type range, not every type >= student", async () => {
    const repos = makeRepos();
    const service = new MessageService(repos.messages, repos.users, repos.emailSender);

    await service.send(ADMIN, { audience: "students", subject: "Oi", message: "Msg" });

    expect(repos.users.listConfirmedEmailsByTypeRange).toHaveBeenCalledWith(UserType.STUDENT, UserType.STUDENT);
  });

  it("records the broadcast in history with the resolved recipient count", async () => {
    const repos = makeRepos();
    const service = new MessageService(repos.messages, repos.users, repos.emailSender);

    await service.send(ADMIN, { audience: "all", subject: "Oi", message: "Msg" });

    expect(repos.messages.create).toHaveBeenCalledWith({
      senderEmail: "admin@x.com",
      recipes: "Todos",
      subject: "Oi",
      message: "Msg",
      recipientCount: 2,
    });
  });

  it("doesn't fail the whole broadcast when one recipient's email fails", async () => {
    const repos = makeRepos();
    repos.emailSender.send = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("smtp down"));
    const service = new MessageService(repos.messages, repos.users, repos.emailSender);

    await expect(service.send(ADMIN, { audience: "all", subject: "Oi", message: "Msg" })).resolves.toEqual(
      MESSAGE,
    );
  });
});

describe("MessageService.list", () => {
  it("rejects a non-admin requester", async () => {
    const repos = makeRepos();
    const service = new MessageService(repos.messages, repos.users, repos.emailSender);

    await expect(service.list(1, 20, PROFESSOR)).rejects.toThrow(ForbiddenError);
  });

  it("wraps the repository result with pagination metadata", async () => {
    const repos = makeRepos();
    const service = new MessageService(repos.messages, repos.users, repos.emailSender);

    await expect(service.list(1, 20, ADMIN)).resolves.toEqual({
      total: 1,
      page: 1,
      pageSize: 20,
      messages: [MESSAGE],
    });
  });
});
