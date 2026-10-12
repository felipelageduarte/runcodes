import { describe, it, expect, vi } from "vitest";
import { QuestionService } from "./question.service.js";
import { NotFoundError } from "../domain/errors.js";
import type { QuestionRepository, QuestionRecord } from "../repositories/question.repository.js";

const QUESTION: QuestionRecord = { id: 1, title: "Why?", text: "Because.", tags: "faq" };

function makeRepo(): QuestionRepository {
  return {
    list: vi.fn().mockResolvedValue({ total: 1, questions: [QUESTION] }),
    findById: vi.fn().mockResolvedValue(QUESTION),
    create: vi.fn().mockResolvedValue(QUESTION),
    update: vi.fn().mockResolvedValue({ ...QUESTION, title: "Updated" }),
    delete: vi.fn().mockResolvedValue(true),
  };
}

describe("QuestionService.getById", () => {
  it("throws NotFoundError when missing", async () => {
    const repo = makeRepo();
    repo.findById = vi.fn().mockResolvedValue(null);
    const service = new QuestionService(repo);

    await expect(service.getById(999)).rejects.toThrow(NotFoundError);
  });

  it("returns the question when found", async () => {
    const repo = makeRepo();
    const service = new QuestionService(repo);

    await expect(service.getById(1)).resolves.toEqual(QUESTION);
  });
});

describe("QuestionService.update/delete", () => {
  it("throws NotFoundError when the row doesn't exist", async () => {
    const repo = makeRepo();
    repo.update = vi.fn().mockResolvedValue(null);
    repo.delete = vi.fn().mockResolvedValue(false);
    const service = new QuestionService(repo);

    await expect(service.update(999, { title: "x" })).rejects.toThrow(NotFoundError);
    await expect(service.delete(999)).rejects.toThrow(NotFoundError);
  });
});
