import type { OfferingRepository, OfferingRecord, ListOfferingsFilter } from "../repositories/offering.repository.js";
import type { CourseRepository } from "../repositories/course.repository.js";
import type { UniversityRepository } from "../repositories/university.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { CommitRepository } from "../repositories/commit.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";

export interface Requester {
  email: string;
  type: number;
  /** Present only while impersonating a lower role via "view as" — the
   * account's real type, kept around as the ceiling a new view-as switch
   * can never cross and for the UI's permanent indicator (see
   * auth.service.ts's viewAs/stopViewAs). */
  realType?: number;
}

export class OfferingService {
  constructor(
    private readonly offerings: OfferingRepository,
    private readonly courses: CourseRepository,
    private readonly universities: UniversityRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly exercises: ExerciseRepository,
    private readonly commits: CommitRepository,
  ) {}

  private async enrich(offerings: OfferingRecord[]) {
    const courseIds = [...new Set(offerings.map((o) => o.courseId))];
    const courses = await Promise.all(courseIds.map((id) => this.courses.findById(id)));
    const coursesById = new Map(courses.filter((c) => c !== null).map((c) => [c.id, c]));

    const universityIds = [...new Set([...coursesById.values()].map((c) => c.universityId))];
    const universitiesById = await this.universities.findByIds(universityIds);

    const staffByOffering = await this.enrollments.listStaffForOfferings(offerings.map((o) => o.id));

    return offerings.map((o) => {
      const course = coursesById.get(o.courseId) ?? null;
      const university = course ? (universitiesById.get(course.universityId) ?? null) : null;
      const staff = staffByOffering.get(o.id) ?? [];
      return {
        ...o,
        course,
        university,
        professors: staff.filter((s) => s.role === 2),
        assistants: staff.filter((s) => s.role === 1),
      };
    });
  }

  async list(filter: ListOfferingsFilter) {
    const { total, offerings } = await this.offerings.list(filter);
    return { total, page: filter.page, pageSize: filter.pageSize, offerings: await this.enrich(offerings) };
  }

  async listMine(userEmail: string) {
    const offeringIds = await this.enrollments.listForUser(userEmail);
    if (offeringIds.length === 0) return { open: [], closed: [] };

    const offerings = await this.offerings.findByIds(offeringIds);
    const enriched = await this.enrich(offerings);
    const now = new Date();
    return {
      open: enriched.filter((o) => o.endDate > now),
      closed: enriched.filter((o) => o.endDate <= now),
    };
  }

  /** Mirrors OfferingsController::view(). */
  async getDetail(id: number, requester: Requester) {
    const offering = await this.offerings.findById(id);
    if (!offering) throw new NotFoundError("Offering not found");

    const isAdmin = requester.type >= UserType.ADMIN;
    const isStaff = isAdmin || (await this.enrollments.isStaff(requester.email, id));
    if (!isStaff && !(await this.enrollments.isEnrolled(requester.email, id))) {
      throw new ForbiddenError();
    }

    const [[enriched], exercises] = await Promise.all([
      this.enrich([offering]),
      this.exercises.listVisible({ offeringId: id, includeUnopened: isStaff }),
    ]);

    // Student's own latest commit per exercise — lets the exercise list
    // show status (entregue/corrigindo/aprovado/nunca entregue) without
    // one request per exercise. Not needed for staff (they see the full
    // class via grades/stats), skipped there to save the query.
    const latestCommitByExercise = isStaff
      ? new Map()
      : new Map(
          (await this.commits.listLatestForUserAcrossExercises(requester.email, exercises.map((e) => e.id))).map(
            (c) => [c.exerciseId, c],
          ),
        );

    return {
      ...enriched,
      exercises: exercises.map((exercise) => ({
        ...exercise,
        myLatestCommit: latestCommitByExercise.get(exercise.id) ?? null,
      })),
    };
  }
}
