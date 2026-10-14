import { randomBytes } from "node:crypto";
import type {
  OfferingRepository,
  OfferingRecord,
  ListOfferingsFilter,
  OfferingUpdate,
} from "../repositories/offering.repository.js";
import type { CourseRepository } from "../repositories/course.repository.js";
import type { UniversityRepository } from "../repositories/university.repository.js";
import { EnrollmentRole, type EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { CommitRepository } from "../repositories/commit.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import type { EmailSender } from "../repositories/email-sender.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";

const ENROLLMENT_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateEnrollmentCode(): string {
  const bytes = randomBytes(4);
  return Array.from(bytes, (b) => ENROLLMENT_CODE_CHARS[b % ENROLLMENT_CODE_CHARS.length]).join("");
}

export interface Requester {
  email: string;
  type: number;
  /** Present only while impersonating a lower role via "view as" — the
   * account's real type, kept around as the ceiling a new view-as switch
   * can never cross and for the UI's permanent indicator (see
   * auth.service.ts's viewAs/stopViewAs). */
  realType?: number;
}

export interface NewOfferingInput {
  courseId: number;
  classroom: string | null;
  endDate: Date;
}

export class OfferingService {
  constructor(
    private readonly offerings: OfferingRepository,
    private readonly courses: CourseRepository,
    private readonly universities: UniversityRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly exercises: ExerciseRepository,
    private readonly commits: CommitRepository,
    private readonly users: UserRepository,
    private readonly emailSender: EmailSender,
  ) {}

  private async requireStaffOrAdmin(offeringId: number, requester: Requester): Promise<void> {
    if (requester.type >= UserType.ADMIN) return;
    if (await this.enrollments.isStaff(requester.email, offeringId)) return;
    throw new ForbiddenError();
  }

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

  /**
   * Mirrors OfferingsController::add() — professor+ opens a new turma for
   * a course at their own university, gets auto-enrolled as its professor,
   * and the enrollment code is emailed to them. The legacy form only ever
   * *showed* courses from the requester's own university in the dropdown
   * (client-side scoping, no server check) — here the university match is
   * enforced server-side instead of trusted from the form.
   */
  async create(requester: Requester, input: NewOfferingInput): Promise<OfferingRecord> {
    if (requester.type < UserType.PROFESSOR) throw new ForbiddenError();

    const [course, user] = await Promise.all([
      this.courses.findById(input.courseId),
      this.users.findByEmail(requester.email),
    ]);
    if (!course) throw new NotFoundError("Course not found");
    if (!user) throw new NotFoundError("User not found");
    if (course.universityId !== user.universityId) {
      throw new ForbiddenError("This course belongs to a different university", "wrong_university");
    }

    let enrollmentCode: string;
    do {
      enrollmentCode = generateEnrollmentCode();
    } while (await this.offerings.findByEnrollmentCode(enrollmentCode));

    const offering = await this.offerings.create({
      courseId: input.courseId,
      classroom: input.classroom,
      endDate: input.endDate,
      enrollmentCode,
    });

    await this.enrollments.create(offering.id, requester.email, EnrollmentRole.PROFESSOR);

    try {
      await this.emailSender.send({
        to: requester.email,
        subject: "Your offering was created",
        text:
          `Your offering for ${course.code} - ${course.title} was created.\n` +
          `Classroom: ${input.classroom ?? "-"}\n` +
          `Enrollment code: ${enrollmentCode}\n` +
          `End date: ${input.endDate.toISOString().slice(0, 10)}`,
      });
    } catch {
      // Best-effort — a dead SMTP server shouldn't roll back a turma that
      // was otherwise created successfully; the enrollment code is also
      // visible in the UI right after creation.
    }

    return offering;
  }

  /** Mirrors OfferingsController::edit() — staff of this specific offering
   * or admin, only `end_date`/`classroom` are editable (same two fields
   * the legacy form whitelists). */
  async update(id: number, requester: Requester, input: OfferingUpdate): Promise<OfferingRecord> {
    const existing = await this.offerings.findById(id);
    if (!existing) throw new NotFoundError("Offering not found");

    await this.requireStaffOrAdmin(id, requester);

    const updated = await this.offerings.update(id, input);
    if (!updated) throw new NotFoundError("Offering not found");
    return updated;
  }

  /** Mirrors OfferingsController::email() — staff of this offering (or
   * admin) emails every non-banned member. Best-effort per recipient,
   * same as MessageService's admin broadcast. */
  async emailMembers(
    id: number,
    requester: Requester,
    input: { subject: string; message: string },
  ): Promise<{ count: number }> {
    const offering = await this.offerings.findById(id);
    if (!offering) throw new NotFoundError("Offering not found");
    await this.requireStaffOrAdmin(id, requester);

    const course = await this.courses.findById(offering.courseId);
    const recipients = await this.enrollments.listMemberEmails(id);

    await Promise.allSettled(
      recipients.map((to) =>
        this.emailSender.send({
          to,
          subject: `[run.codes - ${course?.title ?? "turma"}] ${input.subject}`,
          text: input.message,
        }),
      ),
    );

    return { count: recipients.length };
  }
}
