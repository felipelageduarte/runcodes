import type { QuestionRepository, NewQuestion, QuestionPatch } from "../repositories/question.repository.js";
import { NotFoundError } from "../domain/errors.js";

/** Mirrors QuestionsController — admin manages, anyone can read (the
 * routes for list/get have no requireAuth, same as the legacy
 * Auth->allow('modal')/studentAuthorized covering view). */
export class QuestionService {
  constructor(private readonly questions: QuestionRepository) {}

  async list(page: number, pageSize: number) {
    const { total, questions } = await this.questions.list(page, pageSize);
    return { total, page, pageSize, questions };
  }

  async getById(id: number) {
    const question = await this.questions.findById(id);
    if (!question) throw new NotFoundError("Question not found");
    return question;
  }

  create(input: NewQuestion) {
    return this.questions.create(input);
  }

  async update(id: number, patch: QuestionPatch) {
    const updated = await this.questions.update(id, patch);
    if (!updated) throw new NotFoundError("Question not found");
    return updated;
  }

  async delete(id: number) {
    if (!(await this.questions.delete(id))) throw new NotFoundError("Question not found");
  }
}
