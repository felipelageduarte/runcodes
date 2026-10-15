import { http, HttpResponse } from "msw";

const BASE = "/api";

/** Default happy-path handlers — tests override per-case with
 * `server.use(...)` for error scenarios. */
export const handlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password === "wrong") {
      return HttpResponse.json({ error: "invalid_credentials", code: "invalid_credentials" }, { status: 401 });
    }
    return HttpResponse.json({
      token: "fake-jwt",
      user: { email: body.email, name: "Aluno Teste", type: 0 },
    });
  }),

  http.get(`${BASE}/auth/me`, () => {
    return HttpResponse.json({ error: "missing_token" }, { status: 401 });
  }),

  http.post(`${BASE}/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${BASE}/users`, async ({ request }) => {
    const body = (await request.json()) as { email: string };
    return HttpResponse.json({ email: body.email }, { status: 201 });
  }),

  http.get(`${BASE}/offerings/mine`, () => HttpResponse.json({ open: [], closed: [] })),

  http.get(`${BASE}/exercises/:id/files`, () => HttpResponse.json([])),

  http.get(`${BASE}/exercises/:id/commits`, () => HttpResponse.json([])),
];
