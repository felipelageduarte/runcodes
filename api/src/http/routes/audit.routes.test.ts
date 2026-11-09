import { describe, it, expect, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { createAuditRouter } from "./audit.routes.js";
import { errorHandler } from "../middleware/errorHandler.js";
import type { AuditService } from "../../services/audit.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

function buildApp(userType: number | null) {
  const fakeAuth: RequestHandler = (req, res, next) => {
    if (userType === null) return res.status(401).json({ error: "missing_token" });
    (req as AuthedRequest).user = { email: "x@x.com", type: userType };
    next();
  };
  const service = {
    feed: vi.fn().mockResolvedValue({ total: 1, limit: 50, offset: 0, items: [{ id: 1 }] }),
    stats: vi.fn().mockResolvedValue({ days: 7, total: 1 }),
  } as unknown as AuditService;
  const app = express();
  app.use("/api/admin/audit", createAuditRouter(service, fakeAuth));
  app.use(errorHandler);
  return { app, service };
}

describe("GET /api/admin/audit/feed", () => {
  it("is admin-only", async () => {
    const prof = buildApp(2);
    expect((await request(prof.app).get("/api/admin/audit/feed")).status).toBe(403);
    const anon = buildApp(null);
    expect((await request(anon.app).get("/api/admin/audit/feed")).status).toBe(401);
  });

  it("parses filters and pagination, returning total and items", async () => {
    const { app, service } = buildApp(3);
    const res = await request(app).get(
      "/api/admin/audit/feed?actor=ana&method=post&status=403&route=/users&since=2026-01-01&q=x&limit=20&offset=40",
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 1, limit: 50, offset: 0, items: [{ id: 1 }] });
    expect(service.feed).toHaveBeenCalledWith({
      actor: "ana",
      method: "POST",
      status: 403,
      route: "/users",
      since: new Date("2026-01-01"),
      q: "x",
      limit: 20,
      offset: 40,
    });
  });

  it("rejects limit above 200 and unknown methods", async () => {
    const { app, service } = buildApp(3);
    const ok = await request(app).get("/api/admin/audit/feed?method=POST&limit=200&offset=0&status=201");
    expect(ok.status).toBe(200);
    expect(service.feed).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", limit: 200, offset: 0, status: 201 }),
    );
    expect((await request(app).get("/api/admin/audit/feed?limit=201")).status).toBe(400);
    expect((await request(app).get("/api/admin/audit/feed?method=FOO")).status).toBe(400);
  });
});

describe("GET /api/admin/audit/stats", () => {
  it("defaults to 7 days and caps at 90", async () => {
    const { app, service } = buildApp(3);
    expect((await request(app).get("/api/admin/audit/stats")).status).toBe(200);
    expect(service.stats).toHaveBeenCalledWith(7);
    expect((await request(app).get("/api/admin/audit/stats?days=30")).status).toBe(200);
    expect(service.stats).toHaveBeenCalledWith(30);
    expect((await request(app).get("/api/admin/audit/stats?days=91")).status).toBe(400);
  });
});
