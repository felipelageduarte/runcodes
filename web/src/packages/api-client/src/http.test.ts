import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw/server";
import { apiFetch, ApiError } from "./http";

describe("apiFetch: renovação de sessão em 401 (F2)", () => {
  it("tenta POST /auth/refresh uma vez e repete a chamada original", async () => {
    let calls = 0;
    let refreshed = 0;
    server.use(
      http.get("/api/offerings/mine", () => {
        calls++;
        return calls === 1
          ? HttpResponse.json({ error: "token_expired" }, { status: 401 })
          : HttpResponse.json({ open: [1], closed: [] });
      }),
      http.post("/api/auth/refresh", () => {
        refreshed++;
        return HttpResponse.json({ token: "new", user: { email: "a@x.com", name: "A", type: 0, viewAs: null } });
      }),
    );

    await expect(apiFetch("/offerings/mine")).resolves.toEqual({ open: [1], closed: [] });
    expect(calls).toBe(2);
    expect(refreshed).toBe(1);
  });

  it("se o refresh falha (sessão revogada), devolve o 401 original sem repetir", async () => {
    let calls = 0;
    server.use(
      http.get("/api/offerings/mine", () => {
        calls++;
        return HttpResponse.json({ error: "session_revoked" }, { status: 401 });
      }),
      http.post("/api/auth/refresh", () => HttpResponse.json({ error: "session_revoked" }, { status: 401 })),
    );

    const promise = apiFetch("/offerings/mine");
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ status: 401, code: "session_revoked" });
    expect(calls).toBe(1);
  });

  it("não tenta renovar em /auth/login (401 ali é credencial errada)", async () => {
    let refreshed = 0;
    server.use(http.post("/api/auth/refresh", () => (refreshed++, new HttpResponse(null, { status: 401 }))));

    await expect(
      apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email: "a@x.com", password: "wrong" }) }),
    ).rejects.toMatchObject({ code: "invalid_credentials" });
    expect(refreshed).toBe(0);
  });

  it("requests concorrentes compartilham uma única renovação", async () => {
    let refreshed = 0;
    const seen = new Map<string, number>();
    server.use(
      http.get("/api/exercises/:id/files", ({ params }) => {
        const n = (seen.get(String(params.id)) ?? 0) + 1;
        seen.set(String(params.id), n);
        return n === 1 ? HttpResponse.json({ error: "token_expired" }, { status: 401 }) : HttpResponse.json([]);
      }),
      http.post("/api/auth/refresh", async () => {
        refreshed++;
        await new Promise((r) => setTimeout(r, 20));
        return HttpResponse.json({ token: "new" });
      }),
    );

    await Promise.all([apiFetch("/exercises/1/files"), apiFetch("/exercises/2/files"), apiFetch("/exercises/3/files")]);
    expect(refreshed).toBe(1);
  });
});
