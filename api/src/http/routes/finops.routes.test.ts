import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createFinopsRouter } from "./finops.routes.js";
import { errorHandler } from "../middleware/errorHandler.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import type { FinopsService } from "../../services/finops.service.js";
import { TooManyRequestsError } from "../../domain/errors.js";
import { UserType } from "../../lib/constants.js";

function fakeRequireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const type = req.header("x-test-type");
  if (type === undefined) return res.status(401).json({ error: "missing_token" });
  req.user = { email: "quem@x.com", type: Number(type) };
  next();
}

function buildApp(service: Pick<FinopsService, "get" | "refresh">) {
  const app = express();
  app.use("/api/admin/finops", createFinopsRouter(service as FinopsService, fakeRequireAuth));
  app.use(errorHandler);
  return app;
}

describe("/api/admin/finops", () => {
  it("recusa sem sessão com 401", async () => {
    const service = { get: vi.fn(), refresh: vi.fn() };
    const res = await request(buildApp(service)).get("/api/admin/finops");
    expect(res.status).toBe(401);
    expect(service.get).not.toHaveBeenCalled();
  });

  it.each([UserType.STUDENT, UserType.ASSISTANT, UserType.PROFESSOR])("recusa tipo %i com 403", async (type) => {
    const service = { get: vi.fn(), refresh: vi.fn() };
    const app = buildApp(service);
    expect((await request(app).get("/api/admin/finops").set("x-test-type", String(type))).status).toBe(403);
    expect((await request(app).post("/api/admin/finops/refresh").set("x-test-type", String(type))).status).toBe(403);
    expect(service.get).not.toHaveBeenCalled();
    expect(service.refresh).not.toHaveBeenCalled();
  });

  it("admin lê o relatório", async () => {
    const service = { get: vi.fn().mockResolvedValue({ month: "2026-11" }), refresh: vi.fn() };
    const res = await request(buildApp(service)).get("/api/admin/finops").set("x-test-type", String(UserType.ADMIN));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ month: "2026-11" });
  });

  it("atualizar dentro de 1 h devolve 429 com Retry-After", async () => {
    const service = {
      get: vi.fn(),
      refresh: vi.fn().mockRejectedValue(new TooManyRequestsError("x", "refresh_too_soon", 900)),
    };
    const res = await request(buildApp(service))
      .post("/api/admin/finops/refresh")
      .set("x-test-type", String(UserType.ADMIN));
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBe("900");
    expect(res.body).toEqual({ error: "refresh_too_soon", retryAfterSeconds: 900 });
  });
});
