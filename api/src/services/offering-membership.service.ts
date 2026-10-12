import type { EnrollmentRepository, EnrollmentRecord } from "../repositories/enrollment.repository.js";
import { EnrollmentRole } from "../repositories/enrollment.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
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
}
