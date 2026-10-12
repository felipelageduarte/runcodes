import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

export const PLAGIARISM_QUEUE_NAME = "plagiarism-runs";

export interface PlagiarismJobData {
  runId: number;
}

/** Decouples PlagiarismService from BullMQ — same reasoning as every
 * other repository interface: the service depends on "a place to enqueue
 * a comparison job", not on BullMQ specifically. */
export interface PlagiarismJobQueue {
  enqueue(data: PlagiarismJobData): Promise<void>;
  close(): Promise<void>;
}

export class BullMqPlagiarismJobQueue implements PlagiarismJobQueue {
  private readonly queue: Queue<PlagiarismJobData>;

  constructor(redisUrl: string) {
    this.queue = new Queue<PlagiarismJobData>(PLAGIARISM_QUEUE_NAME, {
      connection: parseRedisUrl(redisUrl),
    });
  }

  async enqueue(data: PlagiarismJobData): Promise<void> {
    await this.queue.add("compare", data, { removeOnComplete: 100, removeOnFail: 100 });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

// Exported so the worker process (which needs a Worker, not a Queue, but
// the same Redis connection shape) doesn't duplicate URL parsing.
export function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    ...(parsed.password ? { password: parsed.password } : {}),
  };
}
