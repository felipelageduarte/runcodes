import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { AuditTab } from "./AuditTab";

function record(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    at: "2026-11-08T12:00:00.000Z",
    actorEmail: `user${id}@x.com`,
    actorType: 3,
    viewAsType: null,
    method: "PUT",
    path: `/api/admin/users/aluno${id}@x.com`,
    route: "/api/admin/users/:email",
    status: 200,
    durationMs: 12,
    ip: "2001:db8::1",
    userAgent: "vitest",
    requestId: `req-${id}`,
    requestBody: { body: { name: "Novo", password: "[redacted]" } },
    targetType: null,
    targetId: null,
    ...overrides,
  };
}

const STATS = {
  days: 7,
  total: 3,
  errors: 1,
  avgDurationMs: 20,
  actors: 2,
  topActions: [{ action: "PUT /api/admin/users/:email", count: 3, avgMs: 20 }],
  topActors: [{ actorEmail: "user1@x.com", count: 3 }],
  daily: [{ day: "2026-11-08", count: 3, errors: 1 }],
};

function mockFeed(total: number) {
  const seen: URL[] = [];
  server.use(
    http.get("/api/admin/audit/stats", () => HttpResponse.json(STATS)),
    http.get("/api/admin/audit/feed", ({ request }) => {
      const url = new URL(request.url);
      seen.push(url);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 50);
      const items = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) =>
        record(offset + i + 1),
      );
      return HttpResponse.json({ total, limit, offset, items });
    }),
  );
  return seen;
}

describe("AuditTab", () => {
  it("renders the feed with the 'N de total' counter and loads more on demand", async () => {
    const seen = mockFeed(120);
    renderWithProviders(<AuditTab />);

    expect(await screen.findByText("50 de 120")).toBeInTheDocument();
    expect(screen.getAllByText("/api/admin/users/:email").length).toBeGreaterThan(1);

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("100 de 120")).toBeInTheDocument();
    expect(seen.map((u) => u.searchParams.get("offset"))).toEqual(["0", "50"]);
  });

  it("hides 'Carregar mais' once everything is loaded and shows stats", async () => {
    mockFeed(2);
    renderWithProviders(<AuditTab />);

    expect(await screen.findByText("2 de 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
    expect(await screen.findByText("Top ações")).toBeInTheDocument();
    expect(screen.getByText("Erros (status ≥ 400)")).toBeInTheDocument();
  });

  it("sends filters as query params and shows the redacted body when a row is expanded", async () => {
    const seen = mockFeed(1);
    renderWithProviders(<AuditTab />);
    await screen.findByText("1 de 1");

    await userEvent.selectOptions(screen.getByLabelText("Método"), "DELETE");
    await screen.findByText("1 de 1");
    const last = seen.at(-1)!;
    expect(last.searchParams.get("method")).toBe("DELETE");

    await userEvent.click(screen.getAllByRole("button", { name: "Expandir detalhes" })[0]);
    expect(screen.getByText("2001:db8::1")).toBeInTheDocument();
    expect(screen.getByText(/\[redacted\]/)).toBeInTheDocument();
  });
});
