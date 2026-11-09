import { describe, it, expect, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw/server";
import { apiBase, apiFetch, ApiError, REQUESTED_WITH_HEADER, REQUESTED_WITH_VALUE } from "./http";

describe("apiBase", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("usa /api quando VITE_API_URL não está definida", () => {
    vi.stubEnv("VITE_API_URL", "");
    expect(apiBase()).toBe("/api");
  });

  it("usa a origem externa sem barra final", () => {
    vi.stubEnv("VITE_API_URL", "https://api.exemplo/");
    expect(apiBase()).toBe("https://api.exemplo");
  });
});

describe("apiFetch e X-Requested-With", () => {
  function capture(method: "get" | "post" | "put" | "patch" | "delete") {
    let seen: string | null | undefined;
    server.use(
      http[method]("/api/echo", ({ request }) => {
        seen = request.headers.get(REQUESTED_WITH_HEADER);
        return HttpResponse.json({ ok: true });
      }),
    );
    return () => seen;
  }

  it.each(["POST", "PUT", "PATCH", "DELETE"] as const)("envia o cabeçalho em %s", async (method) => {
    const seen = capture(method.toLowerCase() as "post");
    await apiFetch("/echo", { method, body: JSON.stringify({}) });
    expect(seen()).toBe(REQUESTED_WITH_VALUE);
  });

  it("envia o cabeçalho em upload multipart (raw)", async () => {
    const seen = capture("post");
    const form = new FormData();
    form.append("file", new Blob(["x"]), "x.txt");
    await apiFetch("/echo", { method: "POST", body: form, raw: true });
    expect(seen()).toBe(REQUESTED_WITH_VALUE);
  });

  it("não envia o cabeçalho em GET", async () => {
    const seen = capture("get");
    await apiFetch("/echo");
    expect(seen()).toBeNull();
  });
});

describe("apiFetch: renovação de sessão em 401 (F2)", () => {
  it("tenta POST /auth/refresh uma vez e repete a chamada original", async () => {
    let calls = 0;
    let refreshed = 0;
    let refreshHeader: string | null | undefined;
    server.use(
      http.get("/api/offerings/mine", () => {
        calls++;
        return calls === 1
          ? HttpResponse.json({ error: "token_expired" }, { status: 401 })
          : HttpResponse.json({ open: [1], closed: [] });
      }),
      http.post("/api/auth/refresh", ({ request }) => {
        refreshed++;
        refreshHeader = request.headers.get(REQUESTED_WITH_HEADER);
        return HttpResponse.json({ token: "new", user: { email: "a@x.com", name: "A", type: 0, viewAs: null } });
      }),
    );

    await expect(apiFetch("/offerings/mine")).resolves.toEqual({ open: [1], closed: [] });
    expect(calls).toBe(2);
    expect(refreshed).toBe(1);
    expect(refreshHeader).toBe(REQUESTED_WITH_VALUE);
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
