import type { CourseRepository, ListCoursesFilter, NewCourse } from "../repositories/course.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import { NotFoundError, ConflictError } from "../domain/errors.js";

export class CourseService {
  constructor(
    private readonly courses: CourseRepository,
    private readonly users: UserRepository,
  ) {}

  async list(filter: ListCoursesFilter) {
    const { total, courses } = await this.courses.list(filter);
    return { total, page: filter.page, pageSize: filter.pageSize, courses };
  }

  async getById(id: number) {
    const course = await this.courses.findById(id);
    if (!course) throw new NotFoundError("Course not found");
    return course;
  }

  /** Mirrors CoursesController::coursesList(): professors/assistants+
   * picking a course for their own university when creating an offering. */
  async searchForUser(userEmail: string, search?: string) {
    const user = await this.users.findByEmail(userEmail);
    if (!user?.universityId) return [];
    return this.courses.searchByUniversity(user.universityId, search);
  }

  /** Mirrors CoursesController::add() — admin-only, one course at a time
   * (the legacy batch-textarea mode isn't ported: a single create form
   * covers the real need, and the batch path had its own inconsistency —
   * uniqueness checked per-university there, globally in the single path). */
  async create(data: NewCourse) {
    if (await this.courses.existsByCode(data.universityId, data.code)) {
      throw new ConflictError("A course with this code already exists at this university", "course_code_taken");
    }
    return this.courses.create(data);
  }
}
