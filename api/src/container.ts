import { PrismaClient } from "@prisma/client";
import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./lib/env.js";

import { PrismaUserRepository } from "./repositories/user.repository.js";
import { PrismaEnrollmentRepository } from "./repositories/enrollment.repository.js";
import { PrismaCourseRepository } from "./repositories/course.repository.js";
import { PrismaUniversityRepository } from "./repositories/university.repository.js";
import { PrismaOfferingRepository } from "./repositories/offering.repository.js";
import { PrismaExerciseRepository } from "./repositories/exercise.repository.js";
import { PrismaExerciseCaseRepository } from "./repositories/exercise-case.repository.js";
import { PrismaExerciseCaseFileRepository } from "./repositories/exercise-case-file.repository.js";
import { PrismaAllowedFileRepository } from "./repositories/allowed-file.repository.js";
import { PrismaCommitRepository } from "./repositories/commit.repository.js";
import { S3StorageRepository } from "./repositories/storage.repository.js";
import { S3CaseStorageRepository } from "./repositories/case-storage.repository.js";
import { PrismaPlagiarismRunRepository } from "./repositories/plagiarism-run.repository.js";
import { PrismaCommitCaseResultRepository } from "./repositories/commit-case-result.repository.js";
import { BullMqPlagiarismJobQueue } from "./repositories/plagiarism-job-queue.js";
import { PrismaTicketRepository } from "./repositories/ticket.repository.js";
import { PrismaAlertRepository } from "./repositories/alert.repository.js";
import { PrismaQuestionRepository } from "./repositories/question.repository.js";
import { PrismaPublicExerciseRepository } from "./repositories/public-exercise.repository.js";
import { PrismaLogRepository } from "./repositories/log.repository.js";
import { PrismaExerciseFileRepository } from "./repositories/exercise-file.repository.js";
import { PrismaCompilationFileRepository } from "./repositories/compilation-file.repository.js";
import { S3AttachmentStorageRepository } from "./repositories/attachment-storage.repository.js";
import { SmtpEmailSender } from "./repositories/email-sender.js";

import { AuthService } from "./services/auth.service.js";
import { UserService } from "./services/user.service.js";
import { EnrollmentService } from "./services/enrollment.service.js";
import { OfferingMembershipService } from "./services/offering-membership.service.js";
import { CourseService } from "./services/course.service.js";
import { OfferingService } from "./services/offering.service.js";
import { ExerciseService } from "./services/exercise.service.js";
import { ExerciseManagementService } from "./services/exercise-management.service.js";
import { ExerciseCaseService } from "./services/exercise-case.service.js";
import { ExerciseCaseFileService } from "./services/exercise-case-file.service.js";
import { CommitService } from "./services/commit.service.js";
import { PlagiarismService } from "./services/plagiarism.service.js";
import { UniversityService } from "./services/university.service.js";
import { AllowedFileService } from "./services/allowed-file.service.js";
import { AdminUserService } from "./services/admin-user.service.js";
import { CommitCaseResultService } from "./services/commit-case-result.service.js";
import { TicketService } from "./services/ticket.service.js";
import { AlertService } from "./services/alert.service.js";
import { QuestionService } from "./services/question.service.js";
import { PublicExerciseService } from "./services/public-exercise.service.js";
import { GradesService } from "./services/grades.service.js";
import { StatsService } from "./services/stats.service.js";
import { ExerciseExportService } from "./services/exercise-export.service.js";
import { LogService } from "./services/log.service.js";
import { ExerciseAttachmentService } from "./services/exercise-attachment.service.js";

import { createRequireAuth } from "./http/middleware/requireAuth.js";
import { createAuditLog } from "./http/middleware/auditLog.js";

/**
 * The composition root: the one place that knows concrete
 * implementations (Prisma, S3, env vars) and wires them into the
 * interfaces every service actually depends on. Nothing outside this
 * file imports a Prisma/S3 client directly — swapping persistence or
 * writing a unit test for a service never touches this wiring.
 */
export function buildContainer() {
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

  const repositories = {
    users: new PrismaUserRepository(prisma),
    enrollments: new PrismaEnrollmentRepository(prisma),
    courses: new PrismaCourseRepository(prisma),
    universities: new PrismaUniversityRepository(prisma),
    offerings: new PrismaOfferingRepository(prisma),
    exercises: new PrismaExerciseRepository(prisma),
    exerciseCases: new PrismaExerciseCaseRepository(prisma),
    exerciseCaseFiles: new PrismaExerciseCaseFileRepository(prisma),
    allowedFiles: new PrismaAllowedFileRepository(prisma),
    commits: new PrismaCommitRepository(prisma),
    commitCaseResults: new PrismaCommitCaseResultRepository(prisma),
    storage: new S3StorageRepository(s3, `${env.S3_BUCKET_PREFIX}-commits`),
    caseStorage: new S3CaseStorageRepository(s3, `${env.S3_BUCKET_PREFIX}-cases`),
    plagiarismRuns: new PrismaPlagiarismRunRepository(prisma),
    tickets: new PrismaTicketRepository(prisma),
    alerts: new PrismaAlertRepository(prisma),
    questions: new PrismaQuestionRepository(prisma),
    publicExercises: new PrismaPublicExerciseRepository(prisma),
    logs: new PrismaLogRepository(prisma),
    exerciseFiles: new PrismaExerciseFileRepository(prisma),
    compilationFiles: new PrismaCompilationFileRepository(prisma),
    exerciseFileStorage: new S3AttachmentStorageRepository(s3, `${env.S3_BUCKET_PREFIX}-files`, "exercisefiles"),
    compilationFileStorage: new S3AttachmentStorageRepository(
      s3,
      `${env.S3_BUCKET_PREFIX}-files`,
      "compilationfiles",
    ),
  };

  const plagiarismQueue = new BullMqPlagiarismJobQueue(env.REDIS_URL);

  const emailSender = new SmtpEmailSender(env.SMTP_FROM, {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
  });

  const services = {
    auth: new AuthService(
      repositories.users,
      env.JWT_SECRET,
      env.JWT_EXPIRES_IN,
      env.LEGACY_PASSWORD_SALT,
    ),
    user: new UserService(repositories.users, emailSender, env.APP_BASE_URL),
    enrollment: new EnrollmentService(
      repositories.enrollments,
      repositories.offerings,
      repositories.courses,
      repositories.users,
    ),
    offeringMembership: new OfferingMembershipService(repositories.enrollments, repositories.users),
    course: new CourseService(repositories.courses, repositories.users),
    offering: new OfferingService(
      repositories.offerings,
      repositories.courses,
      repositories.universities,
      repositories.enrollments,
      repositories.exercises,
    ),
    exercise: new ExerciseService(repositories.exercises, repositories.enrollments),
    exerciseManagement: new ExerciseManagementService(
      repositories.exercises,
      repositories.enrollments,
      repositories.allowedFiles,
    ),
    exerciseCase: new ExerciseCaseService(
      repositories.exercises,
      repositories.enrollments,
      repositories.exerciseCases,
      repositories.caseStorage,
    ),
    exerciseCaseFile: new ExerciseCaseFileService(
      repositories.exercises,
      repositories.enrollments,
      repositories.exerciseCases,
      repositories.exerciseCaseFiles,
      repositories.caseStorage,
    ),
    commit: new CommitService(
      repositories.exercises,
      repositories.enrollments,
      repositories.commits,
      repositories.storage,
    ),
    plagiarism: new PlagiarismService(
      repositories.exercises,
      repositories.enrollments,
      repositories.plagiarismRuns,
      plagiarismQueue,
    ),
    university: new UniversityService(repositories.universities),
    allowedFile: new AllowedFileService(repositories.allowedFiles),
    adminUser: new AdminUserService(repositories.users),
    commitCaseResult: new CommitCaseResultService(
      repositories.commits,
      repositories.exercises,
      repositories.enrollments,
      repositories.commitCaseResults,
      repositories.caseStorage,
    ),
    ticket: new TicketService(repositories.tickets),
    alert: new AlertService(repositories.alerts),
    question: new QuestionService(repositories.questions),
    publicExercise: new PublicExerciseService(repositories.exercises, repositories.publicExercises),
    grades: new GradesService(
      repositories.offerings,
      repositories.exercises,
      repositories.enrollments,
      repositories.commits,
      repositories.courses,
      repositories.universities,
    ),
    stats: new StatsService(
      repositories.exercises,
      repositories.exerciseCases,
      repositories.offerings,
      repositories.enrollments,
      repositories.commits,
      repositories.commitCaseResults,
      repositories.users,
    ),
    exerciseExport: new ExerciseExportService(
      repositories.exercises,
      repositories.enrollments,
      repositories.commits,
      repositories.storage,
      repositories.users,
    ),
    log: new LogService(repositories.logs),
    exerciseFile: new ExerciseAttachmentService(
      repositories.exercises,
      repositories.enrollments,
      repositories.exerciseFiles,
      repositories.exerciseFileStorage,
    ),
    compilationFile: new ExerciseAttachmentService(
      repositories.exercises,
      repositories.enrollments,
      repositories.compilationFiles,
      repositories.compilationFileStorage,
    ),
  };

  const middleware = {
    requireAuth: createRequireAuth(env.JWT_SECRET),
    auditLog: createAuditLog(repositories.logs),
  };

  return {
    prisma,
    repositories,
    services,
    middleware,
    plagiarismQueue,
    async close() {
      await plagiarismQueue.close();
      await prisma.$disconnect();
    },
  };
}

export type Container = ReturnType<typeof buildContainer>;
