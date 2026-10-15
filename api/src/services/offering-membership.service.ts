import type { EnrollmentRepository, EnrollmentRecord } from "../repositories/enrollment.repository.js";
import { EnrollmentRole } from "../repositories/enrollment.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import type { OfferingRepository } from "../repositories/offering.repository.js";
import type { CourseRepository } from "../repositories/course.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

/**
 * Turma (offering) membership management — promoting/demoting a member's
 * role, banning a member. Split out from EnrollmentService on purpose:
 * that one is "a student joining a turma themselves"; this one is "staff
 * managing who's in the turma and what they can do there" — different
 * actors, different authorization rules, same aggregate.
 */
export class OfferingMembershipService {
  constructor(
    private readonly enrollments: EnrollmentRepository,
    private readonly users: UserRepository,
    private readonly offerings: OfferingRepository,
    private readonly courses: CourseRepository,
  ) {}

  private async requireStaffOrAdmin(offeringId: number, requester: Requester): Promise<void> {
    if (requester.type >= UserType.ADMIN) return;
    if (await this.enrollments.isStaff(requester.email, offeringId)) return;
    throw new ForbiddenError();
  }

  private async setRole(
    offeringId: number,
    targetEmail: string,
    role: number,
    requester: Requester,
  ): Promise<EnrollmentRecord> {
    await this.requireStaffOrAdmin(offeringId, requester);

    if (!(await this.users.findByEmail(targetEmail))) {
      throw new NotFoundError("User not found");
    }
    const updated = await this.enrollments.setRole(offeringId, targetEmail, role);
    if (!updated) throw new NotFoundError("User is not enrolled in this offering", "user_not_enrolled");
    return updated;
  }

  /** Mirrors OfferingsController::setProfessor(). */
  setProfessor(offeringId: number, targetEmail: string, requester: Requester) {
    return this.setRole(offeringId, targetEmail, EnrollmentRole.PROFESSOR, requester);
  }

  /** Mirrors OfferingsController::setAssistant(). */
  setAssistant(offeringId: number, targetEmail: string, requester: Requester) {
    return this.setRole(offeringId, targetEmail, EnrollmentRole.ASSISTANT, requester);
  }

  /** Mirrors OfferingsController::setStudent() — demote staff back to student. */
  setStudent(offeringId: number, targetEmail: string, requester: Requester) {
    return this.setRole(offeringId, targetEmail, EnrollmentRole.STUDENT, requester);
  }

  /**
   * Mirrors OfferingsController::ban() — admin-only in the legacy code too
   * (neither professorAuthorized nor studentAuthorized lists it), kept
   * as-is: a professor shouldn't unilaterally remove a student from
   * their own turma without oversight.
   */
  async ban(offeringId: number, targetEmail: string, requester: Requester): Promise<EnrollmentRecord> {
    if (requester.type < UserType.ADMIN) throw new ForbiddenError();

    const updated = await this.enrollments.ban(offeringId, targetEmail);
    if (!updated) throw new NotFoundError("User is not enrolled in this offering", "user_not_enrolled");
    return updated;
  }

  /**
   * Mirrors EnrollmentsController::enroll() — staff/admin matricula outro
   * usuário diretamente, sem depender do código de matrícula. Legado
   * restringia isso a admin (não está em `professorAuthorized` nem
   * `studentAuthorized`); aqui segue a mesma régua de `setRole`/`delete`
   * (staff da turma ou admin) — uma vez que o professor já gerencia papel
   * e desmatrícula de quem já está na turma, adicionar alguém é a mesma
   * categoria de ação, não motivo pra exigir admin.
   */
  async enrollManually(offeringId: number, targetEmail: string, requester: Requester): Promise<EnrollmentRecord> {
    await this.requireStaffOrAdmin(offeringId, requester);

    const [offering, target] = await Promise.all([
      this.offerings.findById(offeringId),
      this.users.findByEmail(targetEmail),
    ]);
    if (!offering) throw new NotFoundError("Offering not found");
    if (!target) throw new NotFoundError("User not found");

    const course = await this.courses.findById(offering.courseId);
    if (course && target.universityId !== null && course.universityId !== target.universityId) {
      throw new ForbiddenError("This classroom belongs to a different university", "wrong_university");
    }

    const existing = await this.enrollments.findOne(targetEmail, offeringId);
    if (existing) {
      throw new ConflictError(
        existing.banned ? "This user was removed from this offering" : "User is already enrolled",
        existing.banned ? "banned_from_offering" : "already_enrolled",
      );
    }

    return this.enrollments.create(offeringId, targetEmail, EnrollmentRole.STUDENT);
  }

  /**
   * Mirrors EnrollmentsController::delete() — hard delete of the matrícula
   * row itself, different from `ban` (soft, admin-only above): the legacy
   * controller lists this under `professorAuthorized`, so staff of this
   * specific offering (not just admin) can do it on their own.
   */
  async unenroll(offeringId: number, targetEmail: string, requester: Requester): Promise<void> {
    await this.requireStaffOrAdmin(offeringId, requester);

    const ok = await this.enrollments.delete(offeringId, targetEmail);
    if (!ok) throw new NotFoundError("User is not enrolled in this offering", "user_not_enrolled");
  }
}
