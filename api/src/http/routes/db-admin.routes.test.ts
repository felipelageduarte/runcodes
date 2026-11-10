import { describe, it, expect, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { createDbAdminRouter } from "./db-admin.routes.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { SqlConsoleError } from "../../domain/errors.js";
import type { DbAdminService } from "../../services/db-admin.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

const ADMIN = 3;
const DEVELOPER = 4;

function buildApp(user: { type: number; realType?: number } | null) {
  const fakeAuth: RequestHandler = (req, res, next) => {
    if (user === null) return res.status(401).json({ error: "missing_token" });
    (req as AuthedRequest).user = { email: "dev@x.com", ...user };
    next();
  };
  const service = {
    health: vi.fn().mockResolvedValue({ connections: 1 }),
    schema: vi.fn().mockResolvedValue({ tables: [], foreignKeys: [] }),
    consoleInfo: vi.fn().mockReturnValue({ writeEnabled: false }),
    runQuery: vi.fn().mockResolvedValue({ kind: "rows", columns: [], rows: [], rowCount: 0, truncated: false }),
  };
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.setHeader("X-Request-Id", "req-9");
    next();
  });
  app.use("/api/admin/db", createDbAdminRouter(service as unknown as DbAdminService, fakeAuth));
  app.use(errorHandler);
  return { app, service };
}

describe("/api/admin/db", () => {
  it("saúde e schema seguem abertos para ADMIN", async () => {
    const { app } = buildApp({ type: ADMIN });
    expect((await request(app).get("/api/admin/db/health")).status).toBe(200);
    expect((await request(app).get("/api/admin/db/schema")).status).toBe(200);
    expect((await request(buildApp({ type: 2 }).app).get("/api/admin/db/health")).status).toBe(403);
    expect((await request(buildApp(null).app).get("/api/admin/db/schema")).status).toBe(401);
  });

  it("o console é só de DEVELOPER", async () => {
    const admin = buildApp({ type: ADMIN });
    expect((await request(admin.app).post("/api/admin/db/query").send({ sql: "select 1" })).status).toBe(403);
    expect((await request(admin.app).get("/api/admin/db/console")).status).toBe(403);
    expect(admin.service.runQuery).not.toHaveBeenCalled();

    const dev = buildApp({ type: DEVELOPER });
    expect((await request(dev.app).get("/api/admin/db/console")).body).toEqual({ writeEnabled: false });
    expect((await request(dev.app).post("/api/admin/db/query").send({ sql: "select 1" })).status).toBe(200);
  });

  it("DEVELOPER em 'ver como' admin perde o console", async () => {
    const { app, service } = buildApp({ type: ADMIN, realType: DEVELOPER });
    expect((await request(app).post("/api/admin/db/query").send({ sql: "select 1" })).status).toBe(403);
    expect(service.runQuery).not.toHaveBeenCalled();
  });

  it("repassa entrada e ator ao service", async () => {
    const { app, service } = buildApp({ type: DEVELOPER });
    await request(app)
      .post("/api/admin/db/query")
      .set("User-Agent", "ua-teste")
      .send({ sql: "update t set a = 1", confirm: true, password: "pw" });

    expect(service.runQuery).toHaveBeenCalledWith(
      { sql: "update t set a = 1", confirm: true, password: "pw" },
      expect.objectContaining({ email: "dev@x.com", type: DEVELOPER, viewAsType: null, userAgent: "ua-teste", requestId: "req-9" }),
    );
  });

  it("corpo inválido responde 400", async () => {
    const { app } = buildApp({ type: DEVELOPER });
    expect((await request(app).post("/api/admin/db/query").send({})).status).toBe(400);
    expect((await request(app).post("/api/admin/db/query").send({ sql: "select 1", password: "" })).status).toBe(400);
  });

  it("erro do banco volta como 422 com a mensagem", async () => {
    const { app, service } = buildApp({ type: DEVELOPER });
    service.runQuery.mockRejectedValueOnce(new SqlConsoleError("sql_error", 'relation "nada" does not exist'));
    const res = await request(app).post("/api/admin/db/query").send({ sql: "select * from nada" });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: "sql_error", detail: 'relation "nada" does not exist' });
  });
});
