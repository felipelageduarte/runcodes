import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { coursesRouter } from "./modules/courses/courses.routes.js";
import { offeringsRouter } from "./modules/offerings/offerings.routes.js";
import { exercisesRouter } from "./modules/exercises/exercises.routes.js";
import { enrollmentsRouter } from "./modules/enrollments/enrollments.routes.js";
import { exerciseCommitsRouter, commitsRouter } from "./modules/commits/commits.routes.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api", healthRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/offerings", offeringsRouter);
app.use("/api/exercises", exercisesRouter);
app.use("/api/exercises/:exerciseId/commits", exerciseCommitsRouter);
app.use("/api/enrollments", enrollmentsRouter);
app.use("/api/commits", commitsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});
