import type { EnrollmentRepository, EnrollmentRecord } from "../repositories/enrollment.repository.js";
import type { OfferingRepository } from "../repositories/offering.repository.js";
import type { CourseRepository } from "../repositories/course.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import { EnrollmentRole } from "../repositories/enrollment.repository.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../domain/errors.js";

export class EnrollmentService {
  constructor(
    private readonly enrollments: EnrollmentRepository,
    private readonly offerings: OfferingRepository,
    private readonly courses: CourseRepository,
    private readonly users: UserRepository,
  ) {}

  /** Mirrors EnrollmentsController::add() — self-enroll via classroom code. */
  async enrollByCode(userEmail: string, code: string): Promise<EnrollmentRecord> {
    const offering = await this.offerings.findByEnrollmentCode(code);
    if (!offering) throw new NotFoundError("Invalid enrollment code", "invalid_enrollment_code");

    const [course, user] = await Promise.all([
      this.courses.findById(offering.courseId),
      this.users.findByEmail(userEmail),
    ]);
    if (course && user?.universityId !== null && course.universityId !== user?.universityId) {
      throw new ForbiddenError("This classroom belongs to a different university", "wrong_university");
    }

    const existing = await this.enrollments.findOne(userEmail, offering.id);
    if (existing) {
      throw new ConflictError(
        existing.banned ? "You were removed from this offering" : "Already enrolled",
        existing.banned ? "banned_from_offering" : "already_enrolled",
      );
    }

    return this.enrollments.create(offering.id, userEmail, EnrollmentRole.STUDENT);
  }

  listMine(userEmail: string) {
    return this.enrollments.listRecordsForUser(userEmail);
  }
}
