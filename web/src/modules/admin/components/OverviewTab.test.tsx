import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { AdminOverview } from "@runcodes/api-client";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { OverviewTab } from "./OverviewTab";

const overview: AdminOverview = {
  usersByType: [
    { type: 0, count: 120 },
    { type: 2, count: 7 },
    { type: 3, count: 1 },
  ],
  commitsQueued: 4,
  commitsStuck: 1,
  compilationErrors24h: 9,
  serverErrors24h: 0,
  ticketsOpen: 2,
  alertsActive: 1,
  stuckMinutes: 15,
  database: {
    ok: true,
    health: {
      connections: 3,
      maxConnections: 100,
      connectionsByState: [{ state: "idle", count: 3 }],
      databaseSizeBytes: 2048,
      uptimeSeconds: 7200,
    },
  },
  generatedAt: "2026-11-08T12:00:00.000Z",
};

const activity = { today: 10, yesterday: 8, last7Days: 50, dailyTrend: [{ date: "2026-11-08", total: 10 }] };

function mockOverview(body: AdminOverview | ((stuckMinutes: number) => AdminOverview)) {
  server.use(
    http.get("/api/admin/overview", ({ request }) => {
      const minutes = Number(new URL(request.url).searchParams.get("stuckMinutes"));
      return HttpResponse.json(typeof body === "function" ? body(minutes) : body);
    }),
    http.get("/api/admin/stats/activity", () => HttpResponse.json(activity)),
  );
}

describe("OverviewTab", () => {
  it("renders the KPIs from /admin/overview and the database health it carries", async () => {
    mockOverview(overview);
    renderWithProviders(<OverviewTab />);

    expect(await screen.findByText("Na fila")).toBeInTheDocument();
    expect(screen.getByText("Presos (> 15 min)")).toBeInTheDocument();
    expect(screen.getByText("Erros de compilação (24 h)")).toBeInTheDocument();
    expect(screen.getByText("Tickets abertos")).toBeInTheDocument();
    expect(screen.getByText("Avisos ativos")).toBeInTheDocument();

    // Usuários por tipo: rótulo vem do shared, contagem do payload.
    const list = screen.getByRole("list", { name: "Usuários por tipo" });
    expect(list).toHaveTextContent("Aluno: 120");
    expect(list).toHaveTextContent("Professor: 7");
    expect(list).toHaveTextContent("Admin: 1");

    // Saúde do banco renderizada pelo DbHealthPanel sem consulta própria
    // (não há handler para /admin/db/health; uma chamada falharia o teste).
    expect(screen.getByText("3 / 100")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Ver fila de tickets" })).toHaveAttribute("href", "/admin/tickets");
    expect(screen.getByRole("link", { name: "Gerenciar avisos" })).toHaveAttribute("href", "/admin/avisos");
  });

  it("refetches with the chosen stuck window", async () => {
    mockOverview((minutes) => ({ ...overview, stuckMinutes: minutes, commitsStuck: minutes === 60 ? 0 : 1 }));
    renderWithProviders(<OverviewTab />);
    await screen.findByText("Presos (> 15 min)");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Janela de commit preso" }), "60");

    expect(await screen.findByText("Presos (> 60 min)")).toBeInTheDocument();
  });

  it("shows the calm message when nothing is queued, stuck or failing", async () => {
    mockOverview({ ...overview, commitsQueued: 0, commitsStuck: 0, serverErrors24h: 0 });
    renderWithProviders(<OverviewTab />);

    expect(await screen.findByRole("status")).toHaveTextContent("Pipeline em dia");
  });

  it("keeps the counters and warns inline when database health failed", async () => {
    mockOverview({ ...overview, database: { ok: false, error: "permission denied" } });
    renderWithProviders(<OverviewTab />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Saúde do banco indisponível");
    expect(screen.getByText("Na fila")).toBeInTheDocument();
  });

  it("shows the empty state for users when no account exists", async () => {
    mockOverview({ ...overview, usersByType: [] });
    renderWithProviders(<OverviewTab />);

    expect(await screen.findByText("Nenhum usuário cadastrado")).toBeInTheDocument();
  });

  it("shows an error state with retry when the API fails, then recovers", async () => {
    let calls = 0;
    server.use(
      http.get("/api/admin/overview", () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ error: "internal_error" }, { status: 500 });
        return HttpResponse.json(overview);
      }),
      http.get("/api/admin/stats/activity", () => HttpResponse.json(activity)),
    );
    renderWithProviders(<OverviewTab />);

    expect(await screen.findByText("Não foi possível carregar o painel")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await waitFor(() => expect(screen.getByText("Na fila")).toBeInTheDocument());
  });

  it("names the permission problem on 403", async () => {
    server.use(http.get("/api/admin/overview", () => HttpResponse.json({ error: "forbidden" }, { status: 403 })));
    renderWithProviders(<OverviewTab />);

    expect(await screen.findByText("Sem permissão")).toBeInTheDocument();
  });
});
