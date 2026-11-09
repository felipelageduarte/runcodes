import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createAdminOverviewRouter } from "./admin-overview.routes.js";
import { errorHandler } from "../middleware/errorHandler.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import type { AdminOverviewService } from "../../services/admin-overview.service.js";
import { UserType } from "../../lib/constants.js";

/** requireAuth de mentira: lê o tipo do usuário de um cabeçalho em vez
 * de validar JWT — o que está sob teste é o gate da rota, não o token. */
function fakeRequireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const type = req.header("x-test-type");
  if (type === undefined) return res.status(401).json({ error: "missing_token" });
  req.user = { email: "quem@x.com", type: Number(type) };
  next();
}

function buildApp(service: Pick<AdminOverviewService, "get">) {
  const app = express();
  app.use("/api/admin/overview", createAdminOverviewRouter(service as AdminOverviewService, fakeRequireAuth));
  app.use(errorHandler);
  return app;
}

const payload = {
  usersByType: [{ type: 0, count: 1 }],
  commitsQueued: 0,
  commitsStuck: 0,
  compilationErrors24h: 0,
  serverErrors24h: 0,
  ticketsOpen: 0,
  alertsActive: 0,
  stuckMinutes: 15,
  database: { ok: false, error: "n/a" },
  generatedAt: "2026-11-08T00:00:00.000Z",
};

describe("GET /api/admin/overview", () => {
  it("rejects an unauthenticated caller with 401", async () => {
    const service = { get: vi.fn() };
    const res = await request(buildApp(service)).get("/api/admin/overview");

    expect(res.status).toBe(401);
    expect(service.get).not.toHaveBeenCalled();
  });

  it.each([UserType.STUDENT, UserType.ASSISTANT, UserType.PROFESSOR])(
    "rejects user type %i with 403",
    async (type) => {
      const service = { get: vi.fn() };
      const res = await request(buildApp(service))
        .get("/api/admin/overview")
        .set("x-test-type", String(type));

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: "forbidden" });
      expect(service.get).not.toHaveBeenCalled();
    },
  );

  it("answers an admin with the service payload and the default window", async () => {
    const service = { get: vi.fn().mockResolvedValue(payload) };
    const res = await request(buildApp(service))
      .get("/api/admin/overview")
      .set("x-test-type", String(UserType.ADMIN));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(payload);
    expect(service.get).toHaveBeenCalledWith(15);
  });

  it("passes stuckMinutes from the query string", async () => {
    const service = { get: vi.fn().mockResolvedValue(payload) };
    const res = await request(buildApp(service))
      .get("/api/admin/overview?stuckMinutes=45")
      .set("x-test-type", String(UserType.DEVELOPER));

    expect(res.status).toBe(200);
    expect(service.get).toHaveBeenCalledWith(45);
  });

  it.each(["0", "abc", "1441", "2.5"])("rejects stuckMinutes=%s with 400", async (value) => {
    const service = { get: vi.fn() };
    const res = await request(buildApp(service))
      .get(`/api/admin/overview?stuckMinutes=${value}`)
      .set("x-test-type", String(UserType.ADMIN));

    expect(res.status).toBe(400);
    expect(service.get).not.toHaveBeenCalled();
  });
});
