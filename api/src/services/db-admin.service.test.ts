import { describe, it, expect, vi } from "vitest";
import {
  DbAdminService,
  SQL_ATTEMPT_STATUS,
  SQL_CONSOLE_LIMITS,
  describeSql,
  type SqlConsoleActor,
} from "./db-admin.service.js";
import { ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from "../domain/errors.js";
import type { DbAdminRepository } from "../repositories/db-admin.repository.js";

const actor: SqlConsoleActor = {
  email: "dev@x.com",
  type: 4,
  viewAsType: null,
  ip: "10.0.0.1",
  userAgent: "vitest",
  requestId: "req-1",
};

function setup(opts: { writeEnabled?: boolean; passwordOk?: boolean; auditFails?: boolean } = {}) {
  const order: string[] = [];
  const repo: DbAdminRepository = {
    health: vi.fn(),
    schema: vi.fn(),
    runSelect: vi.fn().mockImplementation(async () => {
      order.push("select");
      return { kind: "rows", columns: ["id"], rows: [{ id: 1 }], rowCount: 1, truncated: false };
    }),
    runMutation: vi.fn().mockImplementation(async () => {
      order.push("mutation");
      return { kind: "mutation", rowsAffected: 1 };
    }),
  };
  const audit = {
    create: vi.fn().mockImplementation(async () => {
      order.push("audit");
      if (opts.auditFails) throw new Error("audit down");
    }),
  };
  const verifyPassword = vi.fn().mockResolvedValue(opts.passwordOk ?? true);
  const service = new DbAdminService(repo, { audit, verifyPassword, writeEnabled: opts.writeEnabled ?? false });
  return { service, repo, audit, verifyPassword, order };
}

describe("describeSql", () => {
  it("classifica pela primeira palavra-chave e conta os comandos", () => {
    expect(describeSql("  select 1")).toEqual({ keyword: "SELECT", class: "read", statements: 1, chars: 8 });
    expect(describeSql("UPDATE users SET name = 'x'").class).toBe("write");
    expect(describeSql("select 1; delete from users").statements).toBe(2);
    expect(describeSql("select 1;").statements).toBe(1);
  });

  it("comando que não reconhece vira 'other', sem ecoar o texto", () => {
    expect(describeSql("/* x */ DELETE FROM users")).toMatchObject({ keyword: "OTHER", class: "other" });
    expect(describeSql("vacuum")).toMatchObject({ keyword: "OTHER", class: "other" });
  });
});

describe("DbAdminService.runQuery: leitura", () => {
  it("roda SELECT em modo leitura, com timeout e limite de linhas", async () => {
    const { service, repo } = setup();

    const result = await service.runQuery({ sql: "select * from users", confirm: false }, actor);

    expect(repo.runSelect).toHaveBeenCalledWith("select * from users", {
      timeoutMs: SQL_CONSOLE_LIMITS.readTimeoutMs,
      maxRows: SQL_CONSOLE_LIMITS.maxRows,
    });
    expect(result).toMatchObject({ kind: "rows", rowCount: 1 });
  });

  it("comando não classificado como escrita nunca chega a runMutation", async () => {
    const { service, repo } = setup({ writeEnabled: true });

    await service.runQuery({ sql: "/* x */ DELETE FROM users", confirm: true, password: "pw" }, actor);
    await service.runQuery({ sql: "WITH d AS (DELETE FROM users RETURNING 1) SELECT * FROM d", confirm: true, password: "pw" }, actor);

    expect(repo.runSelect).toHaveBeenCalledTimes(2);
    expect(repo.runMutation).not.toHaveBeenCalled();
  });

  it("recusa query vazia, grande demais e com mais de um comando", async () => {
    const { service, repo } = setup();

    await expect(service.runQuery({ sql: "   ", confirm: false }, actor)).rejects.toThrow(ValidationError);
    await expect(service.runQuery({ sql: "SELECT 1; SELECT 2", confirm: false }, actor)).rejects.toMatchObject({
      code: "multiple_statements",
    });
    const big = `select '${"a".repeat(SQL_CONSOLE_LIMITS.maxSqlChars)}'`;
    await expect(service.runQuery({ sql: big, confirm: false }, actor)).rejects.toMatchObject({
      code: "query_too_long",
    });
    expect(repo.runSelect).not.toHaveBeenCalled();
  });

  it("aceita ponto e vírgula final", async () => {
    const { service, repo } = setup();
    await service.runQuery({ sql: "select 1;", confirm: false }, actor);
    expect(repo.runSelect).toHaveBeenCalledOnce();
  });
});

describe("DbAdminService.runQuery: escrita", () => {
  const update = "UPDATE users SET name = 'segredo' WHERE email = 'a@b.com'";

  it("com a flag desligada, recusa mesmo com confirmação e senha", async () => {
    const { service, repo, verifyPassword } = setup({ writeEnabled: false });

    await expect(service.runQuery({ sql: update, confirm: true, password: "pw" }, actor)).rejects.toThrow(
      ForbiddenError,
    );
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(repo.runMutation).not.toHaveBeenCalled();
  });

  it("sem confirmação ou sem senha responde 409", async () => {
    const { service, repo } = setup({ writeEnabled: true });

    await expect(service.runQuery({ sql: update, confirm: false }, actor)).rejects.toThrow(ConflictError);
    await expect(service.runQuery({ sql: update, confirm: true }, actor)).rejects.toThrow(ConflictError);
    await expect(service.runQuery({ sql: update, confirm: false, password: "pw" }, actor)).rejects.toThrow(
      ConflictError,
    );
    expect(repo.runMutation).not.toHaveBeenCalled();
  });

  it("senha errada não executa", async () => {
    const { service, repo, verifyPassword } = setup({ writeEnabled: true, passwordOk: false });

    await expect(service.runQuery({ sql: update, confirm: true, password: "errada" }, actor)).rejects.toThrow(
      UnauthorizedError,
    );
    expect(verifyPassword).toHaveBeenCalledWith("dev@x.com", "errada");
    expect(repo.runMutation).not.toHaveBeenCalled();
  });

  it("com flag, confirmação e senha certa, executa com timeout de escrita", async () => {
    const { service, repo } = setup({ writeEnabled: true });

    const result = await service.runQuery({ sql: update, confirm: true, password: "pw" }, actor);

    expect(repo.runMutation).toHaveBeenCalledWith(update, { timeoutMs: SQL_CONSOLE_LIMITS.writeTimeoutMs });
    expect(result).toEqual({ kind: "mutation", rowsAffected: 1 });
  });
});

describe("DbAdminService.runQuery: auditoria", () => {
  it("grava a tentativa antes de executar, só com metadados", async () => {
    const { service, audit, order } = setup({ writeEnabled: true });
    const sql = "UPDATE users SET name = 'segredo' WHERE email = 'a@b.com'";

    await service.runQuery({ sql, confirm: true, password: "senha-do-dev" }, actor);

    expect(order).toEqual(["audit", "mutation"]);
    const entry = audit.create.mock.calls[0][0];
    expect(entry).toMatchObject({
      actorEmail: "dev@x.com",
      actorType: 4,
      status: SQL_ATTEMPT_STATUS,
      requestId: "req-1",
      targetType: "sql_console",
      requestBody: {
        sqlConsole: { phase: "attempt", keyword: "UPDATE", class: "write", statements: 1, confirm: true, passwordProvided: true },
      },
    });
    const text = JSON.stringify(entry);
    for (const leak of ["segredo", "a@b.com", "senha-do-dev", "users"]) expect(text).not.toContain(leak);
  });

  it("tentativa recusada também fica registrada", async () => {
    const { service, audit } = setup();

    await expect(service.runQuery({ sql: "DELETE FROM users", confirm: false }, actor)).rejects.toThrow();
    await expect(service.runQuery({ sql: "SELECT 1; SELECT 2", confirm: false }, actor)).rejects.toThrow();

    expect(audit.create).toHaveBeenCalledTimes(2);
  });

  it("se a auditoria falha, o comando não roda", async () => {
    const { service, repo } = setup({ auditFails: true });

    await expect(service.runQuery({ sql: "select 1", confirm: false }, actor)).rejects.toThrow("audit down");
    expect(repo.runSelect).not.toHaveBeenCalled();
  });
});
