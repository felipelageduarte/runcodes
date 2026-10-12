import type { CourseRepository, ListCoursesFilter } from "../repositories/course.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import { NotFoundError } from "../domain/errors.js";

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
}
