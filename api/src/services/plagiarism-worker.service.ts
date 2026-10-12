import type { CommitRepository } from "../repositories/commit.repository.js";
import type { StorageRepository } from "../repositories/storage.repository.js";
import type { PlagiarismRunRepository } from "../repositories/plagiarism-run.repository.js";
import type { PlagiarismProvider, SubmissionFile } from "../repositories/plagiarism-provider.js";

/**
 * The actual comparison work, separated from the BullMQ Worker that
 * invokes it — this class has no queue/Redis knowledge, so it's testable
 * with mocked repositories like every other service, and the queueing
 * mechanism could be swapped without touching this logic.
 */
export class PlagiarismWorkerService {
  constructor(
    private readonly runs: PlagiarismRunRepository,
    private readonly commits: CommitRepository,
    private readonly storage: StorageRepository,
    private readonly providers: Record<string, PlagiarismProvider>,
  ) {}

  async processRun(runId: number): Promise<void> {
    const run = await this.runs.findById(runId);
    if (!run) return; // the row was deleted after the job was enqueued — nothing to do

    await this.runs.markRunning(runId);
    try {
      const latestCommits = await this.commits.listLatestPerStudentForExercise(run.exerciseId);
      if (latestCommits.length < 2) {
        await this.runs.markCompleted(runId, []); // nothing to compare — not an error
        return;
      }

      const submissions: SubmissionFile[] = [];
      for (const commit of latestCommits) {
        if (!commit.awsKey) continue;
        const bytes = await this.storage.getCommitFile(commit.awsKey);
        submissions.push({
          studentEmail: commit.userEmail,
          filename: commit.awsKey.split("/").pop() ?? "submission",
          content: Buffer.from(bytes).toString("utf8"),
        });
      }

      const provider = this.providers[run.provider];
      if (!provider) throw new Error(`No provider registered for "${run.provider}"`);

      const result = await provider.compare(submissions);
      await this.runs.markCompleted(runId, result.pairs);
    } catch (err) {
      await this.runs.markFailed(runId, err instanceof Error ? err.message : String(err));
    }
  }
}
