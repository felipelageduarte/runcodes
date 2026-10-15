import { PrismaClient } from "@prisma/client";
import { S3Client } from "@aws-sdk/client-s3";
import { Worker } from "bullmq";
import { env } from "./lib/env.js";
import {
  parseRedisUrl,
  PLAGIARISM_QUEUE_NAME,
  type PlagiarismJobData,
} from "./repositories/plagiarism-job-queue.js";
import { PrismaCommitRepository } from "./repositories/commit.repository.js";
import { PrismaPlagiarismRunRepository } from "./repositories/plagiarism-run.repository.js";
import { S3StorageRepository } from "./repositories/storage.repository.js";
import { DolosProvider } from "./repositories/dolos-provider.js";
import { JPlagProvider } from "./repositories/jplag-provider.js";
import { PlagiarismWorkerService } from "./services/plagiarism-worker.service.js";

/**
 * Entry point for the plagiarism worker — a separate deployable process
 * from the API server (`npm run start:worker`, not started by server.ts),
 * the same way runcodes-compiler is its own process rather than code inside
 * runcodes-api. Reasons, not just convention: JPlag needs a JVM on the
 * host, both tools can run for minutes on a large turma, and neither of
 * those should be a dependency of (or a way to stall) the HTTP API.
 */
const prisma = new PrismaClient();
const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

const workerService = new PlagiarismWorkerService(
  new PrismaPlagiarismRunRepository(prisma),
  new PrismaCommitRepository(prisma),
  new S3StorageRepository(s3, `${env.S3_BUCKET_PREFIX}-commits`),
  {
    dolos: new DolosProvider(),
    jplag: new JPlagProvider(env.JPLAG_JAR_PATH),
  },
);

const worker = new Worker<PlagiarismJobData>(
  PLAGIARISM_QUEUE_NAME,
  async (job) => {
    await workerService.processRun(job.data.runId);
  },
  { connection: parseRedisUrl(env.REDIS_URL), concurrency: 1 },
);

worker.on("ready", () => console.log("plagiarism worker ready"));
worker.on("failed", (job, err) => console.error(`plagiarism job ${job?.id} failed`, err));

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
