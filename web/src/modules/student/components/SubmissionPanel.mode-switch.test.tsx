import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ExerciseDetail } from "@runcodes/api-client";
import { SubmissionPanel } from "./SubmissionPanel";

// O Monaco real não roda bem em jsdom (precisa de ResizeObserver, Web
// Workers etc.) — o que este teste cobre é a troca de modo do
// SubmissionPanel, não o editor em si (isso é coisa de E2E/manual).
vi.mock("@runcodes/editor", () => ({
  CodeEditor: () => <div data-testid="fake-code-editor" />,
  useDraft: (_id: number, initial: string) => ({ value: initial, setValue: vi.fn(), clearDraft: vi.fn() }),
  useUnsavedChangesGuard: vi.fn(),
}));

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

function renderPanel(exercise: ExerciseDetail) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SubmissionPanel exercise={exercise} onSubmitted={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("SubmissionPanel mode switch", () => {
  it("defaults to file upload mode and hides the toggle for non-compilable exercises", () => {
    renderPanel(makeExercise({ type: 1, allowedFiles: [] }));
    expect(screen.getByText("Clique para escolher um arquivo")).toBeInTheDocument();
    expect(screen.queryByText("Escrever código")).not.toBeInTheDocument();
  });

  it("switches to the editor mode for a compilable exercise with a known language", async () => {
    renderPanel(makeExercise());
    expect(screen.getByText("Clique para escolher um arquivo")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Escrever código/ }));

    expect(await screen.findByTestId("fake-code-editor")).toBeInTheDocument();
    expect(screen.queryByText("Clique para escolher um arquivo")).not.toBeInTheDocument();
  });
});
