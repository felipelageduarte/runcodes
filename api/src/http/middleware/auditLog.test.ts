import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createAuditLog } from "./auditLog.js";
import type { LogRepository } from "../../repositories/log.repository.js";
import type { AuthedRequest } from "./requireAuth.js";

function makeReqRes(overrides: Partial<AuthedRequest> = {}) {
  const req = Object.assign(new EventEmitter(), {
    method: "POST",
    originalUrl: "/api/enrollments",
    ip: "127.0.0.1",
    ...overrides,
  }) as unknown as AuthedRequest;
  const res = Object.assign(new EventEmitter(), { statusCode: 201 }) as any;
  return { req, res };
}

describe("auditLog middleware", () => {
  it("skips GET requests entirely", () => {
    const logs: LogRepository = { list: vi.fn(), create: vi.fn() };
    const middleware = createAuditLog(logs);
    const { req, res } = makeReqRes({ method: "GET" } as Partial<AuthedRequest>);
    const next = vi.fn();

    middleware(req, res, next);
    res.emit("finish");

    expect(next).toHaveBeenCalledTimes(1);
    expect(logs.create).not.toHaveBeenCalled();
  });

  it("logs a mutating request after it finishes, attributing it to the authed user", () => {
    const logs: LogRepository = { list: vi.fn(), create: vi.fn().mockResolvedValue(undefined) };
    const middleware = createAuditLog(logs);
    const { req, res } = makeReqRes();
    req.user = { email: "prof@x.com", type: 2 };
    const next = vi.fn();

    middleware(req, res, next);
    expect(logs.create).not.toHaveBeenCalled(); // not yet — only after the response is sent
    res.emit("finish");

    expect(logs.create).toHaveBeenCalledWith({
      userEmail: "prof@x.com",
      ip: "127.0.0.1",
      action: "POST /api/enrollments -> 201",
    });
  });

  it("attributes an unauthenticated mutation to SYSTEM", () => {
    const logs: LogRepository = { list: vi.fn(), create: vi.fn().mockResolvedValue(undefined) };
    const middleware = createAuditLog(logs);
    const { req, res } = makeReqRes();
    const next = vi.fn();

    middleware(req, res, next);
    res.emit("finish");

    expect(logs.create).toHaveBeenCalledWith(
      expect.objectContaining({ userEmail: "SYSTEM" }),
    );
  });

  it("strips the IPv4-mapped-IPv6 prefix and truncates to fit the varchar(15) column", () => {
    const logs: LogRepository = { list: vi.fn(), create: vi.fn().mockResolvedValue(undefined) };
    const middleware = createAuditLog(logs);
    const { req, res } = makeReqRes({ ip: "::ffff:127.0.0.1" } as Partial<AuthedRequest>);
    const next = vi.fn();

    middleware(req, res, next);
    res.emit("finish");

    expect(logs.create).toHaveBeenCalledWith(expect.objectContaining({ ip: "127.0.0.1" }));
  });

  it("never throws even if the repository write rejects", () => {
    const logs: LogRepository = { list: vi.fn(), create: vi.fn().mockRejectedValue(new Error("db down")) };
    const middleware = createAuditLog(logs);
    const { req, res } = makeReqRes();
    const next = vi.fn();

    expect(() => {
      middleware(req, res, next);
      res.emit("finish");
    }).not.toThrow();
  });
});
