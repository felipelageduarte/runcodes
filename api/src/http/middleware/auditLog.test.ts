import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createAuditLog, normalizeRoute, redact, safeBody, MAX_BODY_CHARS } from "./auditLog.js";
import type { AuditRepository, AuditEntry } from "../../repositories/audit.repository.js";
import type { AuthedRequest } from "./requireAuth.js";

function makeRepo(create = vi.fn().mockResolvedValue(undefined)): AuditRepository {
  return { create, feed: vi.fn(), stats: vi.fn(), purgeOlderThan: vi.fn() };
}

function makeReqRes(overrides: Record<string, unknown> = {}, statusCode = 201) {
  const req = Object.assign(new EventEmitter(), {
    method: "POST",
    originalUrl: "/api/enrollments",
    ip: "127.0.0.1",
    headers: { "user-agent": "vitest" },
    query: {},
    body: {},
    ...overrides,
  }) as unknown as AuthedRequest;
  const res = Object.assign(new EventEmitter(), { statusCode, setHeader: vi.fn() }) as any;
  return { req, res };
}

async function run(repo: AuditRepository, overrides: Record<string, unknown> = {}, statusCode = 201) {
  const middleware = createAuditLog(repo);
  const { req, res } = makeReqRes(overrides, statusCode);
  const next = vi.fn();
  middleware(req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  res.emit("finish");
  await Promise.resolve();
  return { req, res, next };
}

function lastEntry(repo: AuditRepository): AuditEntry {
  return (repo.create as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as AuditEntry;
}

describe("redact", () => {
  it("replaces any key matching password|token|secret|authorization|senha, at any depth, case-insensitively", () => {
    const out = redact({
      email: "a@x.com",
      password: "hunter2",
      confirmPassword: "hunter2",
      nested: { accessToken: "abc", Authorization: "Bearer x", senhaAtual: "123", keep: 1 },
      list: [{ clientSecret: "s" }, "plain"],
    }) as Record<string, any>;
    expect(out.email).toBe("a@x.com");
    expect(out.password).toBe("[redacted]");
    expect(out.confirmPassword).toBe("[redacted]");
    expect(out.nested).toEqual({
      accessToken: "[redacted]",
      Authorization: "[redacted]",
      senhaAtual: "[redacted]",
      keep: 1,
    });
    expect(out.list).toEqual([{ clientSecret: "[redacted]" }, "plain"]);
  });
});

describe("safeBody", () => {
  it("truncates bodies above the limit, keeping size and a prefix", () => {
    const out = safeBody({ blob: "x".repeat(MAX_BODY_CHARS + 100) }) as Record<string, unknown>;
    expect(out.truncated).toBe(true);
    expect(out.size).toBeGreaterThan(MAX_BODY_CHARS);
    expect((out.preview as string).length).toBe(MAX_BODY_CHARS);
  });

  it("redacts before truncating, so a secret never survives in the preview", () => {
    const out = safeBody({ password: "p".repeat(MAX_BODY_CHARS + 10), x: 1 }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toContain("ppppp");
  });
});

describe("normalizeRoute", () => {
  it("collapses numeric ids and e-mail segments", () => {
    expect(normalizeRoute("/api/offerings/12/members/prof@x.com/ban")).toBe(
      "/api/offerings/:id/members/:email/ban",
    );
    expect(normalizeRoute("/api/commits/345")).toBe("/api/commits/:id");
    expect(normalizeRoute("/api/offerings/7/members/a%40b.com")).toBe("/api/offerings/:id/members/:email");
    expect(normalizeRoute("/api/admin/users")).toBe("/api/admin/users");
  });
});

describe("auditLog middleware", () => {
  it("skips /api/health entirely", async () => {
    const repo = makeRepo();
    await run(repo, { method: "GET", originalUrl: "/api/health" }, 200);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("records a mutation with actor, normalized route, status, redacted body and request id", async () => {
    const repo = makeRepo();
    const { res } = await run(repo, {
      originalUrl: "/api/admin/users/aluno@x.com?debug=1",
      query: { debug: "1" },
      method: "PUT",
      body: { name: "Novo", password: "hunter2", type: 2 },
      user: { email: "admin@x.com", type: 3 },
    }, 200);

    const entry = lastEntry(repo);
    expect(entry).toMatchObject({
      actorEmail: "admin@x.com",
      actorType: 3,
      viewAsType: null,
      method: "PUT",
      path: "/api/admin/users/aluno@x.com",
      route: "/api/admin/users/:email",
      status: 200,
      ip: "127.0.0.1",
      userAgent: "vitest",
    });
    expect(entry.requestBody).toEqual({
      body: { name: "Novo", password: "[redacted]", type: 2 },
      query: { debug: "1" },
    });
    expect(typeof entry.requestId).toBe("string");
    expect(entry.requestId!.length).toBeGreaterThan(10);
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", entry.requestId);
    expect(typeof entry.durationMs).toBe("number");
    expect(JSON.stringify(entry)).not.toContain("hunter2");
  });

  it("reuses an incoming X-Request-Id header", async () => {
    const repo = makeRepo();
    await run(repo, { headers: { "x-request-id": "req-123", "user-agent": "ua" } });
    expect(lastEntry(repo).requestId).toBe("req-123");
  });

  it("attributes an unauthenticated request to a null actor", async () => {
    const repo = makeRepo();
    await run(repo, {}, 401);
    expect(lastEntry(repo)).toMatchObject({ actorEmail: null, actorType: null, status: 401 });
  });

  it("records the real type as actor and the impersonated type as view-as", async () => {
    const repo = makeRepo();
    await run(repo, { user: { email: "admin@x.com", type: 0, realType: 3 } });
    expect(lastEntry(repo)).toMatchObject({ actorType: 3, viewAsType: 0 });
  });

  it("keeps a full IPv6 address instead of truncating it", async () => {
    const repo = makeRepo();
    const ip = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
    await run(repo, { ip });
    expect(lastEntry(repo).ip).toBe(ip);
  });

  it("stores only field names for login (password never reaches the row)", async () => {
    const repo = makeRepo();
    await run(repo, {
      originalUrl: "/api/auth/login",
      body: { email: "a@x.com", password: "hunter2" },
    }, 200);
    const entry = lastEntry(repo);
    expect(entry.requestBody).toEqual({ fields: ["email", "password"] });
    expect(JSON.stringify(entry)).not.toContain("hunter2");
    expect(JSON.stringify(entry)).not.toContain("a@x.com");
  });

  it("stores only field names for password reset and the SQL console", async () => {
    const repo = makeRepo();
    await run(repo, { originalUrl: "/api/users/reset-password", body: { token: "t", password: "p" } }, 200);
    expect(lastEntry(repo).requestBody).toEqual({ fields: ["token", "password"] });

    await run(repo, { originalUrl: "/api/admin/db/query", body: { sql: "DELETE FROM users", confirm: true } }, 200);
    expect(lastEntry(repo).requestBody).toEqual({ fields: ["sql", "confirm"] });
    expect(JSON.stringify(lastEntry(repo))).not.toContain("DELETE FROM");
  });

  it("records reads too, with the query string but no body", async () => {
    const repo = makeRepo();
    await run(repo, { method: "GET", originalUrl: "/api/admin/users?q=ana&token=x", query: { q: "ana", token: "x" } }, 200);
    expect(lastEntry(repo)).toMatchObject({ method: "GET", route: "/api/admin/users" });
    expect(lastEntry(repo).requestBody).toEqual({ query: { q: "ana", token: "[redacted]" } });

    await run(repo, { method: "GET", originalUrl: "/api/offerings/mine" }, 200);
    expect(lastEntry(repo).requestBody).toBeNull();
  });

  it("never throws even if the repository write rejects or the row cannot be built", async () => {
    const rejecting = makeRepo(vi.fn().mockRejectedValue(new Error("db down")));
    await expect(run(rejecting)).resolves.toBeDefined();

    const throwing = makeRepo(vi.fn(() => { throw new Error("sync boom"); }));
    await expect(run(throwing)).resolves.toBeDefined();
  });
});
