import type { PipelineRepository } from "../repositories/pipeline.repository.js";

/** Admin-only live view of the correction pipeline — reads the same
 * `commits.status` column the runcodes-compiler polls directly, so this
 * is already-live data, not a snapshot that needs its own queue. */
export class PipelineService {
  constructor(private readonly pipeline: PipelineRepository) {}

  async stats() {
    const [inFlight, recentHour] = await Promise.all([
      this.pipeline.inFlightCounts(),
      this.pipeline.recentCounts(60),
    ]);
    return { inFlight, recentHour };
  }

  active(limit = 50) {
    return this.pipeline.active(limit);
  }
}
