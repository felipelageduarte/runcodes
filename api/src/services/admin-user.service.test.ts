import { describe, it, expect, vi } from "vitest";
import { AdminUserService, INVITE_TOKEN_TTL_MS } from "./admin-user.service.js";
import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "../domain/errors.js";
import type { UserRepository, UserRecord } from "../repositories/user.repository.js";
import type { AuditRepository } from "../repositories/audit.repository.js";
import type { EmailSender } from "../repositories/email-sender.js";
import type { AuthService } from "./auth.service.js";
import type { Requester } from "./offering.service.js";
import { UserType } from "../lib/constants.js";
import { hashToken } from "../lib/tokens.js";

const USER: UserRecord = {
  email: "a@x.com",
  name: "A",
  password: "secret-hash",
  type: UserType.STUDENT,
  universityId: 1,
  confirmed: true,
  identifier: null,
  tokenVersion: 0,
  disabledAt: null,
  invitedAt: null,
};

const ADMIN: Requester = { email: "admin@x.com", type: UserType.ADMIN };
const DEVELOPER: Requester = { email: "dev@x.com", type: UserType.DEVELOPER };

function makeRepo(target: Partial<UserRecord> = {}): UserRepository {
  const record = { ...USER, ...target };
  return {
    findByEmail: vi.fn().mockResolvedValue(record),
    updatePassword: vi.fn(),
    existsByEmail: vi.fn().mockResolvedValue(false),
    create: vi.fn(),
    findConfirmationState: vi.fn(),
    confirm: vi.fn(),
    setConfirmationToken: vi.fn(),
    setResetToken: vi.fn(),
    findResetState: vi.fn(),
    resetPassword: vi.fn(),
    listForAdmin: vi.fn().mockResolvedValue({ total: 1, users: [record] }),
    updateByAdmin: vi.fn().mockResolvedValue({ ...record, type: UserType.PROFESSOR }),
    updateProfile: vi.fn(),
    createByAdmin: vi.fn().mockResolvedValue(record),
    deleteByAdmin: vi.fn().mockResolvedValue(true),
    setDisabled: vi.fn().mockResolvedValue(undefined),
    createInvited: vi.fn().mockResolvedValue({ ...record, confirmed: false, invitedAt: new Date() }),
    renewInvite: vi.fn().mockResolvedValue(undefined),
    acceptInvite: vi.fn(),
    countSubmissions: vi.fn().mockResolvedValue(0),
  } as unknown as UserRepository;
}

function makeAuth(verified = true): AuthService {
  return { verifyPassword: vi.fn().mockResolvedValue(verified) } as unknown as AuthService;
}

function makeEmail() {
  return { send: vi.fn().mockResolvedValue(undefined) } satisfies EmailSender;
}

function makeSessions() {
  return { revoke: vi.fn().mockResolvedValue(undefined), refresh: vi.fn() };
}

function build(
  repo = makeRepo(),
  opts: { auth?: AuthService; email?: EmailSender; audit?: AuditRepository; sessions?: ReturnType<typeof makeSessions> } = {},
) {
  const email = opts.email ?? makeEmail();
  const sessions = opts.sessions ?? makeSessions();
  const service = new AdminUserService(
    repo,
    opts.auth ?? makeAuth(),
    email,
    "https://app.example",
    opts.audit,
    sessions,
  );
  return { service, repo, email, sessions };
}

const NEW_USER_INPUT = { email: "new@x.com", name: "New", password: "secret123", type: 0, universityId: 1 };
const INVITE_INPUT = { email: "guest@x.com", name: "Guest", type: UserType.ASSISTANT, universityId: 1 };

describe("AdminUserService.list / getByEmail", () => {
  it("never leaks the password hash nor the token version", async () => {
    const { service } = build();
    const listed = await service.list({ page: 1, pageSize: 20 });
    expect(listed.users[0]).not.toHaveProperty("password");
    expect(listed.users[0]).not.toHaveProperty("tokenVersion");
    expect(listed.total).toBe(1);

    const one = await service.getByEmail("a@x.com");
    expect(one).not.toHaveProperty("password");
    expect(one.email).toBe("a@x.com");
  });

  it("derives the account status", async () => {
    const now = new Date();
    expect((await build(makeRepo()).service.getByEmail("a@x.com")).status).toBe("active");
    expect((await build(makeRepo({ disabledAt: now })).service.getByEmail("a@x.com")).status).toBe("disabled");
    expect(
      (await build(makeRepo({ confirmed: false, invitedAt: now })).service.getByEmail("a@x.com")).status,
    ).toBe("invited");
    expect((await build(makeRepo({ confirmed: false })).service.getByEmail("a@x.com")).status).toBe("unconfirmed");
  });

  it("throws NotFoundError for an unknown user", async () => {
    const repo = makeRepo();
    repo.findByEmail = vi.fn().mockResolvedValue(null);
    await expect(build(repo).service.getByEmail("nobody@x.com")).rejects.toThrow(NotFoundError);
  });
});

describe("trava de rank (F3)", () => {
  it("admin não mexe em outro admin nem em dev, em nenhuma escrita", async () => {
    for (const type of [UserType.ADMIN, UserType.DEVELOPER]) {
      const { service, repo } = build(makeRepo({ type }));
      await expect(service.update(ADMIN, "a@x.com", { name: "B" })).rejects.toMatchObject({ code: "rank_too_high" });
      await expect(service.disable(ADMIN, "a@x.com")).rejects.toThrow(ForbiddenError);
      await expect(service.enable(ADMIN, "a@x.com")).rejects.toThrow(ForbiddenError);
      await expect(service.resendInvite(ADMIN, "a@x.com")).rejects.toThrow(ForbiddenError);
      await expect(service.delete(ADMIN, "a@x.com", "pw")).rejects.toThrow(ForbiddenError);
      expect(repo.updateByAdmin).not.toHaveBeenCalled();
      expect(repo.setDisabled).not.toHaveBeenCalled();
      expect(repo.deleteByAdmin).not.toHaveBeenCalled();
    }
  });

  it("dev mexe em admin (rank maior)", async () => {
    const { service, repo } = build(makeRepo({ type: UserType.ADMIN }));
    await service.disable(DEVELOPER, "a@x.com");
    expect(repo.setDisabled).toHaveBeenCalledWith("a@x.com", true);
  });

  it("ninguém altera a si mesmo, nem com rank maior", async () => {
    const { service, repo } = build(makeRepo({ email: "dev@x.com", type: UserType.ASSISTANT }));
    await expect(service.update(DEVELOPER, "dev@x.com", { name: "X" })).rejects.toMatchObject({
      code: "cannot_manage_self",
    });
    await expect(service.disable(DEVELOPER, "DEV@x.com")).rejects.toMatchObject({ code: "cannot_manage_self" });
    expect(repo.updateByAdmin).not.toHaveBeenCalled();
  });

  it("não concede rank maior que o do próprio ator (criar, convidar, editar)", async () => {
    const { service, repo } = build();
    await expect(service.create(ADMIN, { ...NEW_USER_INPUT, type: UserType.DEVELOPER })).rejects.toMatchObject({
      code: "cannot_grant_higher_rank",
    });
    await expect(service.invite(ADMIN, { ...INVITE_INPUT, type: UserType.DEVELOPER })).rejects.toMatchObject({
      code: "cannot_grant_higher_rank",
    });
    await expect(
      service.update(ADMIN, "a@x.com", { type: UserType.DEVELOPER, confirmTypeChange: true }),
    ).rejects.toMatchObject({ code: "cannot_grant_higher_rank" });
    expect(repo.createByAdmin).not.toHaveBeenCalled();
    expect(repo.createInvited).not.toHaveBeenCalled();
    expect(repo.updateByAdmin).not.toHaveBeenCalled();
  });

  it("admin pode conceder até o próprio rank na criação", async () => {
    const { service, repo } = build();
    await service.create(ADMIN, { ...NEW_USER_INPUT, type: UserType.ADMIN });
    expect(repo.createByAdmin).toHaveBeenCalled();
  });
});

describe("AdminUserService.update", () => {
  it("throws NotFoundError for a missing user", async () => {
    const repo = makeRepo();
    repo.findByEmail = vi.fn().mockResolvedValue(null);
    await expect(build(repo).service.update(ADMIN, "nobody@x.com", { name: "B" })).rejects.toThrow(NotFoundError);
  });

  it("troca de tipo exige confirmTypeChange", async () => {
    const { service, repo } = build();
    await expect(service.update(ADMIN, "a@x.com", { type: UserType.PROFESSOR })).rejects.toThrow(ValidationError);
    await expect(service.update(ADMIN, "a@x.com", { type: UserType.PROFESSOR })).rejects.toMatchObject({
      code: "type_change_not_confirmed",
    });
    expect(repo.updateByAdmin).not.toHaveBeenCalled();

    const result = await service.update(ADMIN, "a@x.com", { type: UserType.PROFESSOR, confirmTypeChange: true });
    expect(result.type).toBe(UserType.PROFESSOR);
    expect(result).not.toHaveProperty("password");
    // confirmTypeChange é da API, não do banco
    expect(repo.updateByAdmin).toHaveBeenCalledWith("a@x.com", { type: UserType.PROFESSOR });
  });

  it("mandar o mesmo tipo não pede confirmação", async () => {
    const { service } = build();
    await expect(service.update(ADMIN, "a@x.com", { type: UserType.STUDENT, name: "B" })).resolves.toBeDefined();
  });

  it("mudar tipo ou confirmed revoga a sessão do alvo; só nome não", async () => {
    const { service, sessions } = build();

    await service.update(ADMIN, "a@x.com", { name: "B" });
    expect(sessions.revoke).not.toHaveBeenCalled();

    await service.update(ADMIN, "a@x.com", { type: UserType.PROFESSOR, confirmTypeChange: true });
    await service.update(ADMIN, "a@x.com", { confirmed: false });
    expect(sessions.revoke).toHaveBeenCalledTimes(2);
    expect(sessions.revoke).toHaveBeenCalledWith("a@x.com");
  });
});

describe("AdminUserService.create", () => {
  it("rejects an email already registered", async () => {
    const repo = makeRepo();
    repo.existsByEmail = vi.fn().mockResolvedValue(true);
    await expect(build(repo).service.create(ADMIN, NEW_USER_INPUT)).rejects.toThrow(ConflictError);
    expect(repo.createByAdmin).not.toHaveBeenCalled();
  });

  it("hashes the password and returns the result without the hash", async () => {
    const { service, repo } = build();
    const result = await service.create(ADMIN, NEW_USER_INPUT);

    const call = (repo.createByAdmin as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.passwordHash).not.toBe("secret123");
    expect(call.passwordHash.startsWith("$2")).toBe(true);
    expect(call.email).toBe("new@x.com");
    expect(result).not.toHaveProperty("password");
  });
});

describe("AdminUserService.invite", () => {
  it("cria conta pendente com token de 72 h em hash e manda o link por e-mail", async () => {
    const { service, repo, email } = build();
    const before = Date.now();
    const result = await service.invite(ADMIN, INVITE_INPUT);

    const call = (repo.createInvited as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.type).toBe(UserType.ASSISTANT);
    expect(call.passwordHash.startsWith("$2")).toBe(true);
    expect(call.tokenExpiresAt.getTime() - before).toBeGreaterThanOrEqual(INVITE_TOKEN_TTL_MS - 1000);
    expect(call.tokenExpiresAt.getTime() - before).toBeLessThanOrEqual(INVITE_TOKEN_TTL_MS + 5000);
    expect(result.status).toBe("invited");

    const message = (email.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const token = /token=([0-9a-f]{64})/.exec(message.text)?.[1];
    expect(message.to).toBe("guest@x.com");
    expect(message.text).toContain("https://app.example/accept-invite?email=guest%40x.com");
    expect(token).toBeDefined();
    // só o hash vai ao banco, nunca o token
    expect(call.tokenHash).toBe(hashToken(token!));
    expect(JSON.stringify(call)).not.toContain(token!);
  });

  it("recusa e-mail já cadastrado e não envia nada", async () => {
    const repo = makeRepo();
    repo.existsByEmail = vi.fn().mockResolvedValue(true);
    const { service, email } = build(repo);
    await expect(service.invite(ADMIN, INVITE_INPUT)).rejects.toThrow(ConflictError);
    expect(email.send).not.toHaveBeenCalled();
  });

  it("escapa o nome no HTML do convite", async () => {
    const { service, email } = build();
    await service.invite(ADMIN, { ...INVITE_INPUT, name: "<b>x</b>" });
    const message = (email.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(message.html).not.toContain("<b>x</b>");
    expect(message.html).toContain("&#60;b&#62;");
  });
});

describe("AdminUserService.resendInvite", () => {
  it("renova o token (72 h) e reenvia o e-mail de convite pendente", async () => {
    const { service, repo, email } = build(makeRepo({ confirmed: false, invitedAt: new Date() }));
    await service.resendInvite(ADMIN, "a@x.com");
    expect(repo.renewInvite).toHaveBeenCalledTimes(1);
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it("recusa conta que não veio de convite ou já aceitou", async () => {
    await expect(build(makeRepo({ confirmed: false })).service.resendInvite(ADMIN, "a@x.com")).rejects.toMatchObject({
      code: "not_invited",
    });
    await expect(
      build(makeRepo({ confirmed: true, invitedAt: new Date() })).service.resendInvite(ADMIN, "a@x.com"),
    ).rejects.toMatchObject({ code: "invite_already_accepted" });
  });
});

describe("desativar e reativar", () => {
  it("desativar grava, derruba a sessão do alvo e é idempotente", async () => {
    const { service, repo, sessions } = build();
    const result = await service.disable(ADMIN, "a@x.com");
    expect(repo.setDisabled).toHaveBeenCalledWith("a@x.com", true);
    expect(sessions.revoke).toHaveBeenCalledWith("a@x.com");
    expect(result).not.toHaveProperty("password");

    const again = build(makeRepo({ disabledAt: new Date() }));
    await again.service.disable(ADMIN, "a@x.com");
    expect(again.repo.setDisabled).not.toHaveBeenCalled();
  });

  it("reativar limpa o estado e só relê a sessão", async () => {
    const { service, repo, sessions } = build(makeRepo({ disabledAt: new Date() }));
    await service.enable(ADMIN, "a@x.com");
    expect(repo.setDisabled).toHaveBeenCalledWith("a@x.com", false);
    expect(sessions.refresh).toHaveBeenCalledWith("a@x.com");
    expect(sessions.revoke).not.toHaveBeenCalled();
  });
});

describe("AdminUserService.delete", () => {
  it("throws UnauthorizedError when the actor's password is wrong, without touching the repo", async () => {
    const { service, repo } = build(makeRepo(), { auth: makeAuth(false) });
    await expect(service.delete(ADMIN, "a@x.com", "wrong")).rejects.toThrow(UnauthorizedError);
    expect(repo.deleteByAdmin).not.toHaveBeenCalled();
  });

  it("recusa conta com submissões e manda desativar", async () => {
    const repo = makeRepo();
    repo.countSubmissions = vi.fn().mockResolvedValue(3);
    const { service } = build(repo);
    await expect(service.delete(ADMIN, "a@x.com", "pw")).rejects.toMatchObject({ code: "user_has_submissions" });
    expect(repo.deleteByAdmin).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when there's no such user", async () => {
    const repo = makeRepo();
    repo.findByEmail = vi.fn().mockResolvedValue(null);
    await expect(build(repo).service.delete(ADMIN, "nobody@x.com", "pw")).rejects.toThrow(NotFoundError);
  });

  it("deletes a clean account after verifying the actor's password and drops the session cache", async () => {
    const auth = makeAuth(true);
    const { service, repo, sessions } = build(makeRepo(), { auth });
    await service.delete(ADMIN, "a@x.com", "correct");
    expect(auth.verifyPassword).toHaveBeenCalledWith("admin@x.com", "correct");
    expect(repo.deleteByAdmin).toHaveBeenCalledWith("a@x.com");
    expect(sessions.refresh).toHaveBeenCalledWith("a@x.com");
  });
});

describe("AdminUserService.history", () => {
  it("lê só as escritas sobre aquele usuário na trilha", async () => {
    const audit = {
      feed: vi.fn().mockResolvedValue({
        total: 1,
        items: [
          {
            at: new Date("2026-11-15T10:00:00Z"),
            actorEmail: "admin@x.com",
            method: "PUT",
            route: "/api/admin/users/:email",
            status: 200,
            requestId: "r1",
            requestBody: { body: { type: 2 } },
            path: "/api/admin/users/a%40x.com",
          },
        ],
      }),
    } as unknown as AuditRepository;
    const repo = makeRepo();
    repo.existsByEmail = vi.fn().mockResolvedValue(true);
    const { service } = build(repo, { audit });

    const result = await service.history("a@x.com", 500);

    expect(audit.feed).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: "user", targetId: "a@x.com", mutationsOnly: true, limit: 100 }),
    );
    expect(result.items[0]).toEqual({
      at: new Date("2026-11-15T10:00:00Z"),
      actorEmail: "admin@x.com",
      method: "PUT",
      route: "/api/admin/users/:email",
      status: 200,
      requestId: "r1",
      changes: { body: { type: 2 } },
    });
  });

  it("usuário inexistente é 404", async () => {
    const repo = makeRepo();
    repo.existsByEmail = vi.fn().mockResolvedValue(false);
    await expect(build(repo).service.history("x@x.com")).rejects.toThrow(NotFoundError);
  });
});
