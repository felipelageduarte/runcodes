import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExerciseStatusBadge } from "./ExerciseStatusBadge";
import type { CommitRecord } from "@runcodes/api-client";

function makeCommit(overrides: Partial<CommitRecord> = {}): CommitRecord {
  return {
    id: 1,
    userEmail: "a@x.com",
    exerciseId: 1,
    commitTime: new Date().toISOString(),
    status: 5,
    hash: "h",
    corrects: 1,
    score: "10",
    compiled: true,
    compiledMessage: null,
    awsKey: "key",
    ip: null,
    ...overrides,
  };
}

describe("ExerciseStatusBadge", () => {
  it("shows 'Não entregue' when there's no commit", () => {
    render(<ExerciseStatusBadge commit={null} />);
    expect(screen.getByText("Não entregue")).toBeInTheDocument();
  });

  it("shows 'Em processamento' while the commit is in the compile/run pipeline", () => {
    render(<ExerciseStatusBadge commit={makeCommit({ status: 0 })} />);
    expect(screen.getByText("Em processamento")).toBeInTheDocument();
  });

  it("shows 'Erro' on a compile/server error", () => {
    render(<ExerciseStatusBadge commit={makeCommit({ status: 6 })} />);
    expect(screen.getByText("Erro")).toBeInTheDocument();
  });

  it("shows 'Aprovado' when the score is above the threshold", () => {
    render(<ExerciseStatusBadge commit={makeCommit({ status: 5, score: "10" })} />);
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
  });

  it("shows 'Reprovado' when completed but the score is at or below the threshold", () => {
    render(<ExerciseStatusBadge commit={makeCommit({ status: 5, score: "3" })} />);
    expect(screen.getByText("Reprovado")).toBeInTheDocument();
  });
});
