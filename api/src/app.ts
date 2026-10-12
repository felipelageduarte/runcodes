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
import { createEnrollmentsRouter } from "./http/routes/enrollments.routes.js";
import { createCommitsRouters } from "./http/routes/commits.routes.js";
import { createUsersRouter } from "./http/routes/users.routes.js";

export function buildApp(container: Container) {
  const { services, middleware } = container;
  const { exerciseCommits, commits } = createCommitsRouters(services.commit, middleware.requireAuth);

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
  app.use("/api/exercises", createExercisesRouter(services.exercise, middleware.requireAuth));
  app.use("/api/exercises/:exerciseId/commits", exerciseCommits);
  app.use("/api/enrollments", createEnrollmentsRouter(services.enrollment, middleware.requireAuth));
  app.use("/api/commits", commits);

  app.use(errorHandler);

  return app;
}
