import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { Container } from "./container.js";
import { errorHandler } from "./http/middleware/errorHandler.js";
import { createAuthRouter } from "./http/routes/auth.routes.js";
import { createHealthRouter } from "./http/routes/health.routes.js";
import { createCoursesRouter } from "./http/routes/courses.routes.js";
import { createOfferingsRouter } from "./http/routes/offerings.routes.js";
import { createExercisesRouter } from "./http/routes/exercises.routes.js";
import { createExerciseManagementRouters } from "./http/routes/exercise-management.routes.js";
import { createExerciseCaseRouters } from "./http/routes/exercise-case.routes.js";
import { createEnrollmentsRouter } from "./http/routes/enrollments.routes.js";
import { createCommitsRouters } from "./http/routes/commits.routes.js";
import { createUsersRouter } from "./http/routes/users.routes.js";
import { createPlagiarismRouters } from "./http/routes/plagiarism.routes.js";
import { createUniversitiesRouter } from "./http/routes/universities.routes.js";
import { createAllowedFilesRouter } from "./http/routes/allowed-files.routes.js";
import { createAdminUsersRouter } from "./http/routes/admin-users.routes.js";
import { createTicketsRouter } from "./http/routes/tickets.routes.js";
import { createAlertsRouter } from "./http/routes/alerts.routes.js";
import { createQuestionsRouter } from "./http/routes/questions.routes.js";
import { createPublicExercisesRouter } from "./http/routes/public-exercises.routes.js";
import { createGradesRouter } from "./http/routes/grades.routes.js";
import { createLogsRouter } from "./http/routes/logs.routes.js";

export function buildApp(container: Container) {
  const { services, middleware } = container;
  const { exerciseCommits, commits } = createCommitsRouters(
    services.commit,
    services.commitCaseResult,
    middleware.requireAuth,
  );
  const { offeringExercises, exercises: exerciseManagement } = createExerciseManagementRouters(
    services.exerciseManagement,
    middleware.requireAuth,
  );
  const { exerciseCases, cases } = createExerciseCaseRouters(services.exerciseCase, middleware.requireAuth);
  const { exerciseRuns, runs: plagiarismRuns } = createPlagiarismRouters(
    services.plagiarism,
    middleware.requireAuth,
  );

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use("/api/auth", createAuthRouter(services.auth));
  app.use("/api/users", createUsersRouter(services.user));
  app.use("/api", createHealthRouter(middleware.requireAuth));
  app.use("/api/courses", createCoursesRouter(services.course, middleware.requireAuth));
  app.use(
    "/api/offerings",
    createOfferingsRouter(services.offering, services.offeringMembership, middleware.requireAuth),
  );
  app.use("/api/offerings/:offeringId/exercises", offeringExercises);
  app.use("/api/exercises", createExercisesRouter(services.exercise, middleware.requireAuth));
  app.use("/api/exercises", exerciseManagement);
  app.use("/api/exercises/:exerciseId/commits", exerciseCommits);
  app.use("/api/exercises/:exerciseId/cases", exerciseCases);
  app.use("/api/exercise-cases", cases);
  app.use("/api/exercises/:exerciseId/plagiarism-runs", exerciseRuns);
  app.use("/api/plagiarism-runs", plagiarismRuns);
  app.use("/api/enrollments", createEnrollmentsRouter(services.enrollment, middleware.requireAuth));
  app.use("/api/commits", commits);
  app.use("/api/universities", createUniversitiesRouter(services.university, middleware.requireAuth));
  app.use("/api/allowed-files", createAllowedFilesRouter(services.allowedFile, middleware.requireAuth));
  app.use("/api/admin/users", createAdminUsersRouter(services.adminUser, middleware.requireAuth));
  app.use("/api/tickets", createTicketsRouter(services.ticket, middleware.requireAuth));
  app.use("/api/alerts", createAlertsRouter(services.alert, middleware.requireAuth));
  app.use("/api/questions", createQuestionsRouter(services.question, middleware.requireAuth));
  app.use(
    "/api/public-exercises",
    createPublicExercisesRouter(services.publicExercise, middleware.requireAuth),
  );
  app.use(
    "/api/offerings/:offeringId/grades",
    createGradesRouter(services.grades, middleware.requireAuth),
  );
  app.use("/api/admin/logs", createLogsRouter(services.log, middleware.requireAuth));

  app.use(errorHandler);

  return app;
}
