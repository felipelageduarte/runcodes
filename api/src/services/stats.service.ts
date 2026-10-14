import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { ExerciseCaseRepository } from "../repositories/exercise-case.repository.js";
import type { OfferingRepository } from "../repositories/offering.repository.js";
import type { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import type { CommitRepository } from "../repositories/commit.repository.js";
import type { CommitCaseResultRepository } from "../repositories/commit-case-result.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

export interface PlatformActivity {
  today: number;
  yesterday: number;
  last7Days: number;
  /** Mais antigo primeiro, 28 dias incluindo hoje. */
  dailyTrend: { date: string; total: number }[];
}

export interface ExerciseCaseStats {
  caseLabels: string[];
  correctPercentage: number[];
}

export interface ExerciseCasesTableRow {
  email: string;
  name: string;
  /** One entry per case, same order as `caseLabels` — null when the
   * student has no commit with a result for that case yet (never
   * submitted, or submitted before this case existed). */
  results: (boolean | null)[];
}

export interface ExerciseCasesTable {
  caseLabels: string[];
  rows: ExerciseCasesTableRow[];
  /** True when at least one student's latest commit predates the most
   * recent change to the exercise's cases — see
   * docs/roadmap/gap-audit-2026-10.md item 14 ("unsafe commits"), not a
   * legacy behavior. */
  hasUnsafeCommits: boolean;
}

export interface OfferingExerciseStats {
  exerciseLabels: string[];
  classAverage: (number | null)[];
  participant?: { name: string; scores: number[] };
}

export interface OfferingInfographic {
  studentCount: number;
  gradesAbove5Percent: number;
  gradesAverage: number;
}

export interface ParticipantCommitSummary {
  id: number;
  commitTime: Date;
  status: number;
  corrects: number | null;
  score: string | null;
}

/** Dashboards for professors/assistants — mirrors
 * ExercisesController::stats()/participantCommits() and
 * OfferingsController::stats()/infographic(). All read-only, all
 * staff/admin-only (same access level the legacy chart partials require). */
export class StatsService {
  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly exerciseCases: ExerciseCaseRepository,
    private readonly offerings: OfferingRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly commits: CommitRepository,
    private readonly commitCaseResults: CommitCaseResultRepository,
    private readonly users: UserRepository,
  ) {}

  private async requireStaff(offeringId: number, requester: Requester): Promise<void> {
    const isAdmin = requester.type >= UserType.ADMIN;
    if (!isAdmin && !(await this.enrollments.isStaff(requester.email, offeringId))) {
      throw new ForbiddenError();
    }
  }

  /** Per-case correctness percentage, based on each student's latest
   * commit — mirrors ExercisesController::stats(). */
  async getExerciseCaseStats(exerciseId: number, requester: Requester): Promise<ExerciseCaseStats> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");
    await this.requireStaff(exercise.offeringId, requester);

    const casesExerciseId = exercise.ghost && exercise.realId ? exercise.realId : exercise.id;
    const cases = await this.exerciseCases.listForExercise(casesExerciseId);
    const correctCounts = new Map(cases.map((c) => [c.id, 0]));

    const latestCommits = await this.commits.listLatestPerStudentForExercise(exerciseId);
    for (const commit of latestCommits) {
      const results = await this.commitCaseResults.listForCommit(commit.id);
      for (const result of results) {
        if (result.status && correctCounts.has(result.exerciseCaseId)) {
          correctCounts.set(result.exerciseCaseId, (correctCounts.get(result.exerciseCaseId) ?? 0) + 1);
        }
      }
    }

    const total = latestCommits.length;
    return {
      caseLabels: cases.map((_, i) => `Case ${i + 1}`),
      correctPercentage: cases.map((c) => {
        const corrects = correctCounts.get(c.id) ?? 0;
        return total > 0 ? (corrects / total) * 100 : 0;
      }),
    };
  }

  /** Student × caso matrix — "who passed which case", not just the
   * aggregate `getExerciseCaseStats` gives. Mirrors `casesTable` from the
   * legacy's `viewProfessor`, not ported before the paridade audit (see
   * docs/roadmap/gap-audit-2026-10.md item 12). */
  async getExerciseCasesTable(exerciseId: number, requester: Requester): Promise<ExerciseCasesTable> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");
    await this.requireStaff(exercise.offeringId, requester);

    const casesExerciseId = exercise.ghost && exercise.realId ? exercise.realId : exercise.id;
    const [cases, maxLastUpdate, latestCommits] = await Promise.all([
      this.exerciseCases.listForExercise(casesExerciseId),
      this.exerciseCases.maxLastUpdate(casesExerciseId),
      this.commits.listLatestPerStudentForExercise(exerciseId),
    ]);
    const caseIndexById = new Map(cases.map((c, i) => [c.id, i]));

    let hasUnsafeCommits = false;
    const rows: ExerciseCasesTableRow[] = [];
    for (const commit of latestCommits) {
      if (maxLastUpdate !== null && commit.commitTime < maxLastUpdate) hasUnsafeCommits = true;

      const results = new Array<boolean | null>(cases.length).fill(null);
      const caseResults = await this.commitCaseResults.listForCommit(commit.id);
      for (const result of caseResults) {
        const index = caseIndexById.get(result.exerciseCaseId);
        if (index !== undefined) results[index] = Boolean(result.status);
      }

      const user = await this.users.findByEmail(commit.userEmail);
      rows.push({ email: commit.userEmail, name: user?.name ?? commit.userEmail, results });
    }

    return {
      caseLabels: cases.map((_, i) => `Case ${i + 1}`),
      rows,
      hasUnsafeCommits,
    };
  }

  /** Commit history of one student on one exercise — mirrors
   * ExercisesController::participantCommits(). */
  async getParticipantCommits(
    exerciseId: number,
    userEmail: string,
    requester: Requester,
  ): Promise<ParticipantCommitSummary[]> {
    const exercise = await this.exercises.findById(exerciseId);
    if (!exercise || exercise.removed) throw new NotFoundError("Exercise not found");
    await this.requireStaff(exercise.offeringId, requester);

    const commits = await this.commits.listForUserOnExercise(exerciseId, userEmail);
    return commits.map((c) => ({
      id: c.id,
      commitTime: c.commitTime,
      status: c.status,
      corrects: c.corrects,
      score: c.score,
    }));
  }

  /** Per-exercise average score for the whole class, optionally
   * overlaid with one participant's own scores — mirrors
   * OfferingsController::stats(). */
  async getOfferingStats(
    offeringId: number,
    requester: Requester,
    participantEmail?: string,
  ): Promise<OfferingExerciseStats> {
    const offering = await this.offerings.findById(offeringId);
    if (!offering) throw new NotFoundError("Offering not found");
    await this.requireStaff(offeringId, requester);

    const participant = participantEmail ? await this.users.findByEmail(participantEmail) : null;

    const exercises = await this.exercises.listVisible({ offeringId, includeUnopened: true });
    const exerciseLabels: string[] = [];
    const classAverage: (number | null)[] = [];
    const participantScores: number[] = [];

    for (const exercise of exercises) {
      exerciseLabels.push(exercise.title);
      const latestCommits = await this.commits.listLatestPerStudentForExercise(exercise.id);
      const scores = latestCommits.map((c) => Number(c.score ?? 0));
      classAverage.push(scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null);

      if (participant) {
        const own = latestCommits.find((c) => c.userEmail === participantEmail);
        participantScores.push(own ? Number(own.score ?? 0) : 0);
      }
    }

    return {
      exerciseLabels,
      classAverage,
      ...(participant ? { participant: { name: participant.name, scores: participantScores } } : {}),
    };
  }

  /** Aggregate class-wide numbers (student count, % scoring above 5, avg
   * score) across every exercise in the offering — mirrors
   * OfferingsController::infographic(). */
  async getOfferingInfographic(offeringId: number, requester: Requester): Promise<OfferingInfographic> {
    const offering = await this.offerings.findById(offeringId);
    if (!offering) throw new NotFoundError("Offering not found");
    await this.requireStaff(offeringId, requester);

    const [students, exercises] = await Promise.all([
      this.enrollments.listStudentsForOffering(offeringId),
      this.exercises.listVisible({ offeringId, includeUnopened: true }),
    ]);

    const allScores: number[] = [];
    for (const exercise of exercises) {
      const latestCommits = await this.commits.listLatestPerStudentForExercise(exercise.id);
      allScores.push(...latestCommits.map((c) => Number(c.score ?? 0)));
    }

    const total = allScores.length;
    const above5 = allScores.filter((s) => s > 5).length;

    return {
      studentCount: students.length,
      gradesAbove5Percent: total > 0 ? (above5 / total) * 100 : 0,
      gradesAverage: total > 0 ? allScores.reduce((a, b) => a + b, 0) / total : 0,
    };
  }

  /** Mirrors StatsController::commitsInfographic()/commitsChart() —
   * volume de submissões da plataforma inteira, não por turma/exercício
   * como o resto deste serviço. Achado na auditoria de paridade de
   * out/2026 (item 20): os stats novos nunca tiveram uma visão global,
   * só por turma. Admin-only. */
  async getPlatformActivity(requester: Requester): Promise<PlatformActivity> {
    if (requester.type < UserType.ADMIN) throw new ForbiddenError();

    const DAYS = 28;
    const startOfToday = new Date(new Date().toDateString());
    const startOfWindow = new Date(startOfToday);
    startOfWindow.setDate(startOfWindow.getDate() - (DAYS - 1));

    const commits = await this.commits.listSince(startOfWindow);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const counts = new Map<string, number>();
    for (const c of commits) {
      const key = dayKey(c.commitTime);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const dailyTrend: PlatformActivity["dailyTrend"] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      dailyTrend.push({ date: key, total: counts.get(key) ?? 0 });
    }

    const yesterday = new Date(startOfToday);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    return {
      today: commits.filter((c) => c.commitTime >= startOfToday).length,
      yesterday: commits.filter((c) => c.commitTime >= yesterday && c.commitTime < startOfToday).length,
      last7Days: commits.filter((c) => c.commitTime >= sevenDaysAgo).length,
      dailyTrend,
    };
  }
}
