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
import { PrismaAuditRepository } from "./repositories/audit.repository.js";
import { AuditService, AUDIT_RETENTION_DAYS } from "./services/audit.service.js";

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

// Retenção da trilha de auditoria (spec F1, Q5: 180 dias). Vive aqui, e não
// num SQL do migrate.sh, porque o migrate só roda no deploy e a tabela cresce
// todo dia; este processo já é o único job de fundo da API. Roda na subida e
// depois uma vez por dia; falha vira log de erro, nunca derruba o worker.
const auditService = new AuditService(new PrismaAuditRepository(prisma));
async function purgeAuditLog() {
  try {
    const removed = await auditService.purgeExpired();
    if (removed > 0) console.log(`audit_log: ${removed} linha(s) com mais de ${AUDIT_RETENTION_DAYS} dias removida(s)`);
  } catch (err) {
    console.error("audit_log: falha na retenção", err);
  }
}
void purgeAuditLog();
const auditRetentionTimer = setInterval(purgeAuditLog, 24 * 60 * 60 * 1000);
auditRetentionTimer.unref();
worker.on("failed", (job, err) => console.error(`plagiarism job ${job?.id} failed`, err));

async function shutdown() {
  clearInterval(auditRetentionTimer);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
