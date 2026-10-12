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
import { PrismaAllowedFileRepository } from "./repositories/allowed-file.repository.js";
import { PrismaCommitRepository } from "./repositories/commit.repository.js";
import { S3StorageRepository } from "./repositories/storage.repository.js";
import { S3CaseStorageRepository } from "./repositories/case-storage.repository.js";

import { AuthService } from "./services/auth.service.js";
import { UserService } from "./services/user.service.js";
import { EnrollmentService } from "./services/enrollment.service.js";
import { OfferingMembershipService } from "./services/offering-membership.service.js";
import { CourseService } from "./services/course.service.js";
import { OfferingService } from "./services/offering.service.js";
import { ExerciseService } from "./services/exercise.service.js";
import { ExerciseManagementService } from "./services/exercise-management.service.js";
import { ExerciseCaseService } from "./services/exercise-case.service.js";
import { CommitService } from "./services/commit.service.js";

import { createRequireAuth } from "./http/middleware/requireAuth.js";

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
    allowedFiles: new PrismaAllowedFileRepository(prisma),
    commits: new PrismaCommitRepository(prisma),
    storage: new S3StorageRepository(s3, `${env.S3_BUCKET_PREFIX}-commits`),
    caseStorage: new S3CaseStorageRepository(s3, `${env.S3_BUCKET_PREFIX}-cases`),
  };

  const services = {
    auth: new AuthService(
      repositories.users,
      env.JWT_SECRET,
      env.JWT_EXPIRES_IN,
      env.LEGACY_PASSWORD_SALT,
    ),
    user: new UserService(repositories.users),
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
    commit: new CommitService(
      repositories.exercises,
      repositories.enrollments,
      repositories.commits,
      repositories.storage,
    ),
  };

  const middleware = {
    requireAuth: createRequireAuth(env.JWT_SECRET),
  };

  return {
    prisma,
    repositories,
    services,
    middleware,
    async close() {
      await prisma.$disconnect();
    },
  };
}

export type Container = ReturnType<typeof buildContainer>;
