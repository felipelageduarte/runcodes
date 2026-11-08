import { describe, it, expect } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { createCsrfGuard, allowedOriginsFrom } from "./csrfGuard.js";

function app(requireHeader: boolean) {
  const a = express();
  a.use(cookieParser());
  a.use(createCsrfGuard({ allowedOrigins: allowedOriginsFrom("https://app.run.codes/", "http://localhost:5173"), requireHeader }));
  a.post("/x", (_req, res) => res.json({ ok: true }));
  a.get("/x", (_req, res) => res.json({ ok: true }));
  return a;
}

const COOKIE = "token=abc";

describe("csrfGuard", () => {
  it("allowedOriginsFrom normaliza e rejeita lixo", () => {
    expect(allowedOriginsFrom("https://app.run.codes/", " http://localhost:5173 ,")).toEqual([
      "https://app.run.codes",
      "http://localhost:5173",
    ]);
    expect(() => allowedOriginsFrom("nope")).toThrow(/invalid origin/);
  });

  it("não mexe em GET nem em request sem cookie de sessão (Bearer segue livre)", async () => {
    expect((await request(app(true)).get("/x").set("Cookie", COOKIE)).status).toBe(200);
    expect((await request(app(true)).post("/x").set("Authorization", "Bearer t")).status).toBe(200);
  });

  it("mutação com cookie sem Origin/Referer: 403 csrf_origin_missing", async () => {
    const res = await request(app(true)).post("/x").set("Cookie", COOKIE);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "csrf_origin_missing" });
  });

  it("Origin fora da lista: 403 csrf_origin_mismatch", async () => {
    const res = await request(app(true))
      .post("/x")
      .set("Cookie", COOKIE)
      .set("Origin", "https://evil.example")
      .set("X-Requested-With", "runcodes-web");
    expect(res.body).toEqual({ error: "csrf_origin_mismatch" });
  });

  it("Origin aceita + cabeçalho: passa; Referer serve quando Origin falta", async () => {
    const ok = await request(app(true))
      .post("/x")
      .set("Cookie", COOKIE)
      .set("Origin", "http://localhost:5173")
      .set("X-Requested-With", "runcodes-web");
    expect(ok.status).toBe(200);
    const viaReferer = await request(app(true))
      .post("/x")
      .set("Cookie", COOKIE)
      .set("Referer", "https://app.run.codes/admin/usuarios")
      .set("X-Requested-With", "runcodes-web");
    expect(viaReferer.status).toBe(200);
  });

  it("sem X-Requested-With: 403 quando exigido, passa na transição (CSRF_REQUIRE_HEADER=false)", async () => {
    const strict = await request(app(true)).post("/x").set("Cookie", COOKIE).set("Origin", "http://localhost:5173");
    expect(strict.body).toEqual({ error: "csrf_header_missing" });
    const lenient = await request(app(false)).post("/x").set("Cookie", COOKIE).set("Origin", "http://localhost:5173");
    expect(lenient.status).toBe(200);
  });
});
