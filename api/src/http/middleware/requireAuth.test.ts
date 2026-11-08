import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createRequireAuth, type AuthedRequest } from "./requireAuth.js";
import { requirePermission } from "./requirePermission.js";
import { SessionRevocation, SessionStateCache, type SessionState } from "../../lib/session-state.js";
import { UserType } from "../../lib/constants.js";

const SECRET = "test-secret";
const ADMIN = "admin@x.com";

/** Banco falso + relógio controlado: `db` é o que o requireAuth releria
 * depois do cache; `now` avança para simular o TTL de 60 s. */
function harness() {
  const db = new Map<string, SessionState>();
  db.set(ADMIN, { type: UserType.ADMIN, confirmed: true, tokenVersion: 0 });
  let now = 1_000_000;
  const source = {
    reads: 0,
    async findSessionState(email: string) {
      source.reads++;
      const u = db.get(email);
      return u ? { ...u } : null;
    },
  };
  const store = {
    async bumpTokenVersion(email: string) {
      const u = db.get(email);
      if (u) u.tokenVersion++;
    },
  };
  const cache = new SessionStateCache(source, 60_000, () => now);
  const sessions = new SessionRevocation(store, cache);
  const requireAuth = createRequireAuth(SECRET, cache);

  const app = express();
  app.use(cookieParser());
  app.get("/me", requireAuth, (req: AuthedRequest, res) => res.json(req.user));
  app.get("/admin", requireAuth, requirePermission("admin.users:manage"), (_req, res) => res.json({ ok: true }));

  return {
    app,
    db,
    source,
    sessions,
    cache,
    advance(ms: number) {
      now += ms;
    },
  };
}

function sign(claims: Record<string, unknown>, opts: jwt.SignOptions = {}) {
  return jwt.sign(claims, SECRET, { subject: ADMIN, expiresIn: "1h", ...opts });
}

describe("requireAuth", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it("aceita o token via cookie ou Bearer e expõe o papel lido do banco", async () => {
    const token = sign({ type: UserType.ADMIN, tv: 0 });
    const viaCookie = await request(h.app).get("/me").set("Cookie", `token=${token}`);
    const viaBearer = await request(h.app).get("/me").set("Authorization", `Bearer ${token}`);
    expect(viaCookie.status).toBe(200);
    expect(viaBearer.body).toEqual({ email: ADMIN, type: UserType.ADMIN });
  });

  it("rejeita `tv` divergente com session_revoked", async () => {
    const stale = sign({ type: UserType.ADMIN, tv: 0 });
    await h.sessions.revoke(ADMIN); // token_version vira 1
    const res = await request(h.app).get("/admin").set("Authorization", `Bearer ${stale}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "session_revoked" });
  });

  it("token sem `tv` (anterior à F2) vale como tv = 0 e morre na primeira revogação", async () => {
    const legacy = sign({ type: UserType.ADMIN });
    expect((await request(h.app).get("/admin").set("Authorization", `Bearer ${legacy}`)).status).toBe(200);
    await h.sessions.revoke(ADMIN);
    expect((await request(h.app).get("/admin").set("Authorization", `Bearer ${legacy}`)).status).toBe(401);
  });

  it("rebaixar o admin pelo service invalida a sessão dele na hora (cache invalidado)", async () => {
    const token = sign({ type: UserType.ADMIN, tv: 0 });
    expect((await request(h.app).get("/admin").set("Authorization", `Bearer ${token}`)).status).toBe(200);

    // O que AdminUserService.update faz: escreve e chama sessions.revoke.
    h.db.get(ADMIN)!.type = UserType.STUDENT;
    await h.sessions.revoke(ADMIN);

    const res = await request(h.app).get("/admin").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401); // tv divergente vem antes do 403
  });

  it("escrita por fora do processo (sem invalidar) vale em até 60 s", async () => {
    const token = sign({ type: UserType.ADMIN, tv: 0 });
    expect((await request(h.app).get("/admin").set("Authorization", `Bearer ${token}`)).status).toBe(200);
    expect(h.source.reads).toBe(1);

    h.db.get(ADMIN)!.type = UserType.STUDENT; // só o banco mudou; o cache não sabe
    expect((await request(h.app).get("/admin").set("Authorization", `Bearer ${token}`)).status).toBe(200);
    expect(h.source.reads).toBe(1);

    h.advance(60_001);
    const res = await request(h.app).get("/admin").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(h.source.reads).toBe(2);
    // e o papel visto pela rota é o do banco, não o do token
    const me = await request(h.app).get("/me").set("Authorization", `Bearer ${token}`);
    expect(me.body.type).toBe(UserType.STUDENT);
  });

  it("conta desconfirmada perde a sessão", async () => {
    const token = sign({ type: UserType.ADMIN, tv: 0 });
    h.db.get(ADMIN)!.confirmed = false;
    h.cache.invalidate(ADMIN);
    const res = await request(h.app).get("/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "account_not_confirmed" });
  });

  it("usuário apagado perde a sessão", async () => {
    const token = sign({ type: UserType.ADMIN, tv: 0 });
    h.db.delete(ADMIN);
    expect((await request(h.app).get("/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
  });

  it("view-as: papel efetivo é o do token, realType é relido do banco", async () => {
    const token = sign({ type: UserType.STUDENT, realType: UserType.ADMIN, tv: 0 });
    const me = await request(h.app).get("/me").set("Authorization", `Bearer ${token}`);
    expect(me.body).toEqual({ email: ADMIN, type: UserType.STUDENT, realType: UserType.ADMIN });
    expect((await request(h.app).get("/admin").set("Authorization", `Bearer ${token}`)).status).toBe(403);
  });

  it("view-as cai quando a conta real é rebaixada até o papel visto", async () => {
    const token = sign({ type: UserType.PROFESSOR, realType: UserType.ADMIN, tv: 0 });
    h.db.get(ADMIN)!.type = UserType.ASSISTANT;
    h.cache.invalidate(ADMIN);
    const me = await request(h.app).get("/me").set("Authorization", `Bearer ${token}`);
    expect(me.body).toEqual({ email: ADMIN, type: UserType.ASSISTANT });
  });

  it("token expirado responde token_expired (o cliente tenta /auth/refresh)", async () => {
    const token = sign({ type: UserType.ADMIN, tv: 0 }, { expiresIn: -10 });
    const res = await request(h.app).get("/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "token_expired" });
  });

  it("sem token: missing_token; assinatura errada: invalid_token", async () => {
    expect((await request(h.app).get("/me")).body).toEqual({ error: "missing_token" });
    const forged = jwt.sign({ type: 3, tv: 0 }, "other", { subject: ADMIN });
    expect((await request(h.app).get("/me").set("Authorization", `Bearer ${forged}`)).body).toEqual({
      error: "invalid_token",
    });
  });
});

describe("requirePermission", () => {
  it("recusa chave fora do catálogo na montagem, não em runtime", () => {
    expect(() => requirePermission("admin.nope:x" as never)).toThrow(/not in ADMIN_PERMISSIONS/);
  });
});
