import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createAdminUsersRouter } from "./admin-users.routes.js";
import { errorHandler } from "../middleware/errorHandler.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import type { AdminUserService } from "../../services/admin-user.service.js";
import { UserType } from "../../lib/constants.js";

/** requireAuth de mentira: lê e-mail e tipo de cabeçalhos. O que está sob
 * teste é a fiação da rota (gate, validação, ator repassado ao service). */
function fakeRequireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const type = req.header("x-test-type");
  if (type === undefined) return res.status(401).json({ error: "missing_token" });
  req.user = { email: "admin@x.com", type: Number(type) };
  next();
}

function makeService() {
  return {
    list: vi.fn().mockResolvedValue({ total: 0, users: [] }),
    getByEmail: vi.fn().mockResolvedValue({ email: "a@x.com" }),
    create: vi.fn().mockResolvedValue({ email: "n@x.com" }),
    invite: vi.fn().mockResolvedValue({ email: "g@x.com", status: "invited" }),
    update: vi.fn().mockResolvedValue({ email: "a@x.com" }),
    resendInvite: vi.fn().mockResolvedValue({ email: "g@x.com" }),
    disable: vi.fn().mockResolvedValue({ email: "a@x.com", status: "disabled" }),
    enable: vi.fn().mockResolvedValue({ email: "a@x.com", status: "active" }),
    history: vi.fn().mockResolvedValue({ items: [] }),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function buildApp(service: ReturnType<typeof makeService>) {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/users", createAdminUsersRouter(service as unknown as AdminUserService, fakeRequireAuth));
  app.use(errorHandler);
  return app;
}

const ADMIN = String(UserType.ADMIN);
const ACTOR = { email: "admin@x.com", type: UserType.ADMIN };

describe("/api/admin/users (A3)", () => {
  it("401 sem sessão e 403 para quem não é admin, em toda rota nova", async () => {
    const service = makeService();
    const app = buildApp(service);
    const calls = [
      () => request(app).post("/api/admin/users/invite").send({}),
      () => request(app).post("/api/admin/users/a%40x.com/disable"),
      () => request(app).post("/api/admin/users/a%40x.com/enable"),
      () => request(app).post("/api/admin/users/a%40x.com/resend-invite"),
      () => request(app).get("/api/admin/users/a%40x.com/history"),
    ];
    for (const call of calls) expect((await call()).status).toBe(401);
    for (const call of calls) {
      const res = await (call() as unknown as request.Test).set("x-test-type", String(UserType.PROFESSOR));
      expect(res.status).toBe(403);
    }
    expect(service.invite).not.toHaveBeenCalled();
    expect(service.disable).not.toHaveBeenCalled();
  });

  it("convite: valida o corpo, repassa o ator e responde 201", async () => {
    const service = makeService();
    const app = buildApp(service);

    const bad = await request(app).post("/api/admin/users/invite").set("x-test-type", ADMIN).send({ email: "x" });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(service.invite).not.toHaveBeenCalled();

    const ok = await request(app)
      .post("/api/admin/users/invite")
      .set("x-test-type", ADMIN)
      .send({ email: "g@x.com", name: "G", type: 1 });
    expect(ok.status).toBe(201);
    expect(service.invite).toHaveBeenCalledWith(ACTOR, { email: "g@x.com", name: "G", type: 1, universityId: null });
  });

  it("edição repassa o ator e o confirmTypeChange; tipo fora de 0..4 é recusado", async () => {
    const service = makeService();
    const app = buildApp(service);

    await request(app)
      .put("/api/admin/users/a%40x.com")
      .set("x-test-type", ADMIN)
      .send({ type: 2, confirmTypeChange: true });
    expect(service.update).toHaveBeenCalledWith(ACTOR, "a@x.com", { type: 2, confirmTypeChange: true });

    const bad = await request(app).put("/api/admin/users/a%40x.com").set("x-test-type", ADMIN).send({ type: 9 });
    expect(bad.status).toBeGreaterThanOrEqual(400);
  });

  it("desativar, reativar e reenviar convite chamam o service com o ator", async () => {
    const service = makeService();
    const app = buildApp(service);

    const off = await request(app).post("/api/admin/users/a%40x.com/disable").set("x-test-type", ADMIN);
    expect(off.body).toEqual({ email: "a@x.com", status: "disabled" });
    expect(service.disable).toHaveBeenCalledWith(ACTOR, "a@x.com");

    await request(app).post("/api/admin/users/a%40x.com/enable").set("x-test-type", ADMIN);
    expect(service.enable).toHaveBeenCalledWith(ACTOR, "a@x.com");

    await request(app).post("/api/admin/users/g%40x.com/resend-invite").set("x-test-type", ADMIN);
    expect(service.resendInvite).toHaveBeenCalledWith(ACTOR, "g@x.com");
  });

  it("histórico respeita o limite pedido e a rota /history não cai em /:email", async () => {
    const service = makeService();
    const app = buildApp(service);

    const res = await request(app).get("/api/admin/users/a%40x.com/history?limit=10").set("x-test-type", ADMIN);
    expect(res.status).toBe(200);
    expect(service.history).toHaveBeenCalledWith("a@x.com", 10);
    expect(service.getByEmail).not.toHaveBeenCalled();
  });

  it("exclusão exige a senha e repassa o ator", async () => {
    const service = makeService();
    const app = buildApp(service);

    const missing = await request(app).delete("/api/admin/users/a%40x.com").set("x-test-type", ADMIN).send({});
    expect(missing.status).toBeGreaterThanOrEqual(400);
    expect(service.delete).not.toHaveBeenCalled();

    const ok = await request(app).delete("/api/admin/users/a%40x.com").set("x-test-type", ADMIN).send({ password: "pw" });
    expect(ok.status).toBe(204);
    expect(service.delete).toHaveBeenCalledWith(ACTOR, "a@x.com", "pw");
  });
});
