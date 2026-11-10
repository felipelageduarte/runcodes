import { describe, it, expect, vi } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { PrismaDbAdminRepository, toSqlConsoleError } from "./db-admin.repository.js";
import { SqlConsoleError } from "../domain/errors.js";

function fakePrisma(rows: Record<string, unknown>[] = []) {
  const calls: string[] = [];
  const tx = {
    $executeRawUnsafe: vi.fn().mockImplementation(async (sql: string) => {
      calls.push(sql);
      return 3;
    }),
    $queryRawUnsafe: vi.fn().mockImplementation(async (sql: string) => {
      calls.push(sql);
      return rows;
    }),
  };
  const $transaction = vi.fn().mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
  return { prisma: { $transaction } as unknown as PrismaClient, calls, $transaction };
}

function pgError(code: string, message: string) {
  return new Prisma.PrismaClientKnownRequestError("Raw query failed", {
    code: "P2010",
    clientVersion: "test",
    meta: { code, message },
  });
}

describe("PrismaDbAdminRepository: console SQL", () => {
  it("leitura abre transação READ ONLY com statement_timeout antes da query", async () => {
    const { prisma, calls, $transaction } = fakePrisma([{ id: 1 }]);

    await new PrismaDbAdminRepository(prisma).runSelect("select 1", { timeoutMs: 5000, maxRows: 10 });

    expect(calls).toEqual(["SET TRANSACTION READ ONLY", "SET LOCAL statement_timeout = 5000", "select 1"]);
    expect($transaction.mock.calls[0][1]).toMatchObject({ timeout: 10_000 });
  });

  it("corta o resultado em maxRows e avisa", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i }));
    const { prisma } = fakePrisma(rows);

    const result = await new PrismaDbAdminRepository(prisma).runSelect("select", { timeoutMs: 1000, maxRows: 2 });

    expect(result).toEqual({ kind: "rows", columns: ["id"], rows: rows.slice(0, 2), rowCount: 5, truncated: true });
  });

  it("escrita não usa READ ONLY, mas tem timeout", async () => {
    const { prisma, calls } = fakePrisma();

    const result = await new PrismaDbAdminRepository(prisma).runMutation("delete from t", { timeoutMs: 30_000 });

    expect(calls).toEqual(["SET LOCAL statement_timeout = 30000", "delete from t"]);
    expect(result).toEqual({ kind: "mutation", rowsAffected: 3 });
  });
});

describe("toSqlConsoleError", () => {
  it("statement_timeout vira query_timeout", () => {
    const err = toSqlConsoleError(pgError("57014", "canceling statement due to statement timeout"));
    expect(err).toBeInstanceOf(SqlConsoleError);
    expect((err as SqlConsoleError).code).toBe("query_timeout");
  });

  it("escrita em transação somente leitura vira sql_error com a mensagem do banco", () => {
    const err = toSqlConsoleError(pgError("25006", "cannot execute DELETE in a read-only transaction"));
    expect(err).toMatchObject({ code: "sql_error", detail: "cannot execute DELETE in a read-only transaction" });
  });

  it("erro que não é do banco passa adiante sem detalhe", () => {
    const boom = new Error("connection lost");
    expect(toSqlConsoleError(boom)).toBe(boom);
  });
});
