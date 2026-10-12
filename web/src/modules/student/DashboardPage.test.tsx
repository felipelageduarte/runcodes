import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/msw/server";
import { DashboardPage } from "./DashboardPage";

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  it("shows the empty state with a call-to-action when the student has no open offerings", async () => {
    renderDashboard();

    expect(await screen.findByText("Você ainda não entrou em nenhuma turma")).toBeInTheDocument();
  });

  it("renders the exercise queue sorted by urgency (unsolved first, soonest deadline first)", async () => {
    server.use(
      http.get("/api/offerings/mine", () =>
        HttpResponse.json({
          open: [{ id: 1, courseId: 1, year: 2026, term: 1, classroom: "A", endDate: "2099-01-01", enrollmentCode: null, maxStudents: 0, maxExercises: 0, course: { id: 1, code: "X", title: "Intro à Computação", universityId: 1 }, university: null, professors: [], assistants: [] }],
          closed: [],
        }),
      ),
      http.get("/api/offerings/1", () =>
        HttpResponse.json({
          id: 1, courseId: 1, year: 2026, term: 1, classroom: "A", endDate: "2099-01-01", enrollmentCode: null, maxStudents: 0, maxExercises: 0,
          course: { id: 1, code: "X", title: "Intro à Computação", universityId: 1 }, university: null, professors: [], assistants: [],
          exercises: [
            {
              id: 10, offeringId: 1, title: "Mais urgente", description: null,
              deadline: new Date(Date.now() + 3_600_000).toISOString(), type: 0,
              openDate: new Date(Date.now() - 1000).toISOString(), showBeforeOpening: false,
              ghost: false, realId: null, markdown: false, myLatestCommit: null,
            },
            {
              id: 11, offeringId: 1, title: "Já aprovado", description: null,
              deadline: new Date(Date.now() + 1000).toISOString(), type: 0,
              openDate: new Date(Date.now() - 1000).toISOString(), showBeforeOpening: false,
              ghost: false, realId: null, markdown: false,
              myLatestCommit: { id: 1, userEmail: "a@x.com", exerciseId: 11, commitTime: new Date().toISOString(), status: 5, hash: "h", corrects: 1, score: "10", compiled: true, compiledMessage: null, awsKey: "k", ip: null },
            },
            {
              id: 12, offeringId: 1, title: "Menos urgente", description: null,
              deadline: new Date(Date.now() + 7_200_000).toISOString(), type: 0,
              openDate: new Date(Date.now() - 1000).toISOString(), showBeforeOpening: false,
              ghost: false, realId: null, markdown: false, myLatestCommit: null,
            },
          ],
        }),
      ),
    );

    renderDashboard();

    const titles = await screen.findAllByText(/Mais urgente|Já aprovado|Menos urgente/);
    expect(titles.map((el) => el.textContent)).toEqual(["Mais urgente", "Menos urgente", "Já aprovado"]);
  });
});
