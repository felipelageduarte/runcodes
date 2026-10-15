import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw/server";
import { Toaster } from "@runcodes/ui";
import type { ExerciseDetail } from "@runcodes/api-client";
import { SubmissionPanel } from "./SubmissionPanel";

function makeExercise(overrides: Partial<ExerciseDetail> = {}): ExerciseDetail {
  return {
    id: 1,
    offeringId: 1,
    title: "Ex",
    description: null,
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    type: 0,
    openDate: new Date(Date.now() - 1000).toISOString(),
    showBeforeOpening: false,
    ghost: false,
    realId: null,
    markdown: false,
    isOpen: true,
    offering: null,
    casesCount: 1,
    allowedFiles: [
      { id: 1, name: "Python", extension: "*.py", compilable: true, compileCommand: null, runCommand: null, available: true },
    ],
    ...overrides,
  };
}

function renderPanel(exercise: ExerciseDetail, onSubmitted = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <SubmissionPanel exercise={exercise} onSubmitted={onSubmitted} />
    </QueryClientProvider>,
  );
  return { onSubmitted };
}

describe("SubmissionPanel", () => {
  it("shows a closed message instead of the upload area when the exercise isn't open", () => {
    renderPanel(makeExercise({ isOpen: false }));
    expect(screen.getByText(/fechado para novas submissões/)).toBeInTheDocument();
    expect(screen.queryByText("Enviar submissão")).not.toBeInTheDocument();
  });

  it("rejects a disallowed file extension before ever calling the API", async () => {
    renderPanel(makeExercise());
    const input = document.getElementById("commit-file") as HTMLInputElement;
    const file = new File(["x"], "solution.exe", { type: "application/octet-stream" });

    await userEvent.upload(input, file);

    expect(await screen.findByText(/Tipo de arquivo não aceito/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar submissão" })).toBeDisabled();
  });

  it("rejects a file over the exercise's size limit", async () => {
    renderPanel(makeExercise());
    const input = document.getElementById("commit-file") as HTMLInputElement;
    const bigContent = new Uint8Array(1_000_001);
    const file = new File([bigContent], "solution.py");

    await userEvent.upload(input, file);

    expect(await screen.findByText(/muito grande/)).toBeInTheDocument();
  });

  it("submits a valid file and calls onSubmitted with the created commit", async () => {
    server.use(
      http.post("/api/exercises/1/commits", () =>
        HttpResponse.json(
          {
            id: 99,
            userEmail: "a@x.com",
            exerciseId: 1,
            commitTime: new Date().toISOString(),
            status: 0,
            hash: "h",
            corrects: null,
            score: null,
            compiled: null,
            compiledMessage: null,
            awsKey: "key",
            ip: null,
          },
          { status: 201 },
        ),
      ),
    );
    const { onSubmitted } = renderPanel(makeExercise());
    const input = document.getElementById("commit-file") as HTMLInputElement;
    const file = new File(["print(1)"], "solution.py");

    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole("button", { name: "Enviar submissão" }));

    expect(await screen.findByText("Enviado! Acompanhe o resultado abaixo.")).toBeInTheDocument();
    expect(onSubmitted).toHaveBeenCalledWith(expect.objectContaining({ id: 99 }));
  });
});
