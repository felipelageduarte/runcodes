import type { PrismaClient } from "@prisma/client";
import { CommitStatus } from "../lib/constants.js";

/** Statuses that mean "the compiler-engine hasn't finished with this
 * commit yet" — see compiler-engine/src/rcc/engine/poller.py, which
 * polls this same status column directly (no queue in front of it). */
const IN_FLIGHT_STATUSES = [CommitStatus.IN_QUEUE, CommitStatus.COMPILING, CommitStatus.RUNNING];

export interface StatusCount {
  status: number;
  count: number;
}

export interface ActiveCommit {
  id: number;
  userEmail: string;
  exerciseId: number;
  exerciseTitle: string;
  status: number;
  commitTime: Date;
  compilationStarted: Date | null;
}

export interface PipelineRepository {
  /** Commits currently queued/compiling/running — no time window, since
   * by definition there are few of these at once. */
  inFlightCounts(): Promise<StatusCount[]>;
  /** All outcomes in the last hour — throughput/error-rate signal. */
  recentCounts(sinceMinutes: number): Promise<StatusCount[]>;
  active(limit: number): Promise<ActiveCommit[]>;
}

export class PrismaPipelineRepository implements PipelineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async inFlightCounts(): Promise<StatusCount[]> {
    const rows = await this.prisma.commits.groupBy({
      by: ["status"],
      where: { status: { in: [...IN_FLIGHT_STATUSES] } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  }

  async recentCounts(sinceMinutes: number): Promise<StatusCount[]> {
    const rows = await this.prisma.commits.groupBy({
      by: ["status"],
      where: { commit_time: { gte: new Date(Date.now() - sinceMinutes * 60_000) } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  }

  async active(limit: number): Promise<ActiveCommit[]> {
    const rows = await this.prisma.commits.findMany({
      where: { status: { in: [...IN_FLIGHT_STATUSES] } },
      orderBy: { commit_time: "asc" },
      take: limit,
      include: { exercises: { select: { title: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      userEmail: r.user_email,
      exerciseId: r.exercise_id,
      exerciseTitle: r.exercises.title,
      status: r.status,
      commitTime: r.commit_time,
      compilationStarted: r.compilation_started,
    }));
  }
}
