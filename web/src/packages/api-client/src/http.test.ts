import { describe, it, expect, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw/server";
import { apiBase, apiFetch, REQUESTED_WITH_HEADER, REQUESTED_WITH_VALUE } from "./http";

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
