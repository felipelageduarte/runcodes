import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { Worker } from "bullmq";
import { buildContainer, type Container } from "../container.js";
import { buildApp } from "../app.js";
import { parseRedisUrl, PLAGIARISM_QUEUE_NAME, type PlagiarismJobData } from "../repositories/plagiarism-job-queue.js";
import { PlagiarismWorkerService } from "../services/plagiarism-worker.service.js";
import { DolosProvider } from "../repositories/dolos-provider.js";
import { JPlagProvider } from "../repositories/jplag-provider.js";
import { env } from "../lib/env.js";

// Exercises the real stack wired up by container.ts — actual Postgres,
// actual S3/SeaweedFS, actual Express routing — instead of the mocked
// repositories the unit tests use. It creates its own course/offering/
// exercise/users so it never depends on (or disturbs) local-dev's seed
// data, and the submission test waits on the real Python compiler-engine
// (already running in the local-dev compose) to grade it.
//
// Requires: local-dev docker compose up, .env pointing at it.
// Run with `npm run test:integration`.

const TEST_PASSWORD = "integration-test-password";
const RUN_ID = Date.now();
// code: varchar(16), enrollment_code: varchar(10) — keep the per-run suffix short.
const SHORT_ID = String(RUN_ID).slice(-7);

const emails = {
  admin: `itest-admin-${RUN_ID}@example.com`,
  student: `itest-student-${RUN_ID}@example.com`,
  outsider: `itest-outsider-${RUN_ID}@example.com`,
  signup: `itest-signup-${RUN_ID}@example.com`,
  newStaff: `itest-newstaff-${RUN_ID}@example.com`,
  professor: `itest-professor-${RUN_ID}@example.com`,
};

let container: Container;
let app: ReturnType<typeof buildApp>;

let courseId: number;
let offeringId: number;
let exerciseId: number;
let commitId: number;
let crudExerciseId: number;
let crudCaseId: number;
let secondOfferingId: number;
let ghostExerciseId: number;
let exerciseFileId: number;
let plagiarismWorker: Worker<PlagiarismJobData>;

async function login(email: string) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

beforeAll(async () => {
  container = buildContainer();
  app = buildApp(container);
  const prisma = container.prisma;

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
  await prisma.user.createMany({
    data: [
      { email: emails.admin, name: "ITest Admin", password: passwordHash, type: 3, confirmed: true, universityId: 1 },
      { email: emails.student, name: "ITest Student", password: passwordHash, type: 0, confirmed: true, universityId: 1 },
      { email: emails.outsider, name: "ITest Outsider", password: passwordHash, type: 0, confirmed: true, universityId: 1 },
      { email: emails.newStaff, name: "ITest New Staff", password: passwordHash, type: 0, confirmed: true, universityId: 1 },
      { email: emails.professor, name: "ITest Professor", password: passwordHash, type: 0, confirmed: true, universityId: 1 },
    ],
  });

  const course = await prisma.courses.create({
    data: { code: `ITEST${SHORT_ID}`, title: `Integration Test Course ${RUN_ID}`, university_id: 1 },
  });
  courseId = course.id;

  const offering = await prisma.offerings.create({
    data: {
      course_id: courseId,
      year: 2099,
      term: 1,
      classroom: "IT",
      end_date: new Date("2099-12-31"),
      enrollment_code: `IT${SHORT_ID}`,
    },
  });
  offeringId = offering.id;

  await prisma.enrollments.create({
    data: { offering_id: offeringId, user_email: emails.newStaff, role: 0 },
  });
  await prisma.enrollments.create({
    data: { offering_id: offeringId, user_email: emails.professor, role: 2 },
  });

  const secondOffering = await prisma.offerings.create({
    data: {
      course_id: courseId,
      year: 2099,
      term: 2,
      classroom: "IT2",
      end_date: new Date("2099-12-31"),
    },
  });
  secondOfferingId = secondOffering.id;
  await prisma.enrollments.create({
    data: { offering_id: secondOfferingId, user_email: emails.professor, role: 2 },
  });

  const exercise = await prisma.exercises.create({
    data: {
      offering_id: offeringId,
      title: "Integration Exercise",
      description: 'print("integration ok")',
      deadline: new Date(Date.now() + 86_400_000),
      user_email: emails.admin,
      type: 0, // compilable
      open_date: new Date(Date.now() - 1000),
      show_before_opening: false,
      removed: false,
    },
  });
  exerciseId = exercise.id;

  const pyFile = await prisma.allowed_files.findFirst({ where: { extension: "py" } });
  if (pyFile) {
    await prisma.allowed_files_exercises.create({
      data: { exercise_id: exerciseId, allowed_file_id: pyFile.id },
    });
  }

  // In-process worker — same setup as src/worker.ts — so the plagiarism
  // tests don't depend on a separately running `npm run start:worker`.
  const workerService = new PlagiarismWorkerService(
    container.repositories.plagiarismRuns,
    container.repositories.commits,
    container.repositories.storage,
    { dolos: new DolosProvider(), jplag: new JPlagProvider(env.JPLAG_JAR_PATH) },
  );
  plagiarismWorker = new Worker<PlagiarismJobData>(
    PLAGIARISM_QUEUE_NAME,
    async (job) => workerService.processRun(job.data.runId),
    { connection: parseRedisUrl(env.REDIS_URL), concurrency: 1 },
  );
  await plagiarismWorker.waitUntilReady();
});

afterAll(async () => {
  await plagiarismWorker.close();
  const prisma = container.prisma;
  await prisma.commits_exercise_cases.deleteMany({ where: { commit_id: commitId } }).catch(() => {});
  await prisma.commits.deleteMany({ where: { exercise_id: exerciseId } }).catch(() => {});
  await prisma.allowed_files_exercises.deleteMany({ where: { exercise_id: exerciseId } }).catch(() => {});
  await prisma.exercises.deleteMany({ where: { id: exerciseId } }).catch(() => {});
  if (crudCaseId) {
    await container.repositories.caseStorage.deleteCase(crudCaseId).catch(() => {});
    await prisma.exercise_cases.deleteMany({ where: { id: crudCaseId } }).catch(() => {});
  }
  if (crudExerciseId) {
    await prisma.exercises.deleteMany({ where: { id: crudExerciseId } }).catch(() => {});
  }
  if (exerciseFileId) {
    await container.repositories.exerciseFileStorage.delete(exerciseId, "material.txt").catch(() => {});
  }
  await container.repositories.compilationFileStorage.delete(exerciseId, "helper.py").catch(() => {});
  await prisma.exercise_files.deleteMany({ where: { exercise_id: exerciseId } }).catch(() => {});
  await prisma.compilation_files.deleteMany({ where: { exercise_id: exerciseId } }).catch(() => {});
  if (ghostExerciseId) {
    await prisma.exercises.deleteMany({ where: { id: ghostExerciseId } }).catch(() => {});
  }
  await prisma.enrollments.deleteMany({ where: { offering_id: { in: [offeringId, secondOfferingId] } } }).catch(() => {});
  await prisma.offerings.deleteMany({ where: { id: { in: [offeringId, secondOfferingId] } } }).catch(() => {});
  await prisma.courses.deleteMany({ where: { id: courseId } }).catch(() => {});
  await prisma.user
    .deleteMany({ where: { email: { in: [...Object.values(emails), `second-${emails.signup}`] } } })
    .catch(() => {});
  await container.close();
});

describe("auth", () => {
  it("rejects an unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "x" });
    expect(res.status).toBe(401);
  });

  it("logs in a real user against a real bcrypt hash in Postgres", async () => {
    const token = await login(emails.student);
    expect(token).toBeTruthy();
  });
});

describe("courses", () => {
  it("is forbidden for a non-admin", async () => {
    const token = await login(emails.student);
    const res = await request(app).get("/api/courses").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("lists the fixture course for an admin", async () => {
    const token = await login(emails.admin);
    const res = await request(app)
      .get("/api/courses")
      .query({ code: `ITEST${SHORT_ID}` })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.courses.map((c: { id: number }) => c.id)).toContain(courseId);
  });
});

describe("offerings + enrollment", () => {
  it("is forbidden to view offering detail before enrolling", async () => {
    const token = await login(emails.outsider);
    const res = await request(app)
      .get(`/api/offerings/${offeringId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("rejects an unknown enrollment code", async () => {
    const token = await login(emails.student);
    const res = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${token}`)
      .send({ enrollment_code: "NOPE-NOT-A-CODE" });
    expect(res.status).toBe(404);
  });

  it("enrolls via the real code and is idempotently rejected on retry", async () => {
    const token = await login(emails.student);
    const first = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${token}`)
      .send({ enrollment_code: `it${SHORT_ID}` }); // lowercase, repo uppercases
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${token}`)
      .send({ enrollment_code: `IT${SHORT_ID}` });
    expect(second.status).toBe(409);
  });

  it("shows the offering and its exercise once enrolled", async () => {
    const token = await login(emails.student);
    const res = await request(app)
      .get(`/api/offerings/${offeringId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.exercises.map((e: { id: number }) => e.id)).toContain(exerciseId);
  });
});

describe("submission pipeline", () => {
  it("rejects a disallowed file extension", async () => {
    const token = await login(emails.student);
    const res = await request(app)
      .post(`/api/exercises/${exerciseId}/commits`)
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.from("nope"), "bad.txt");
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("file_type_not_allowed");
  });

  it("accepts a valid submission, uploads it to S3, and queues it", async () => {
    const token = await login(emails.student);
    const res = await request(app)
      .post(`/api/exercises/${exerciseId}/commits`)
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.from('print("integration ok")'), "solution.py");

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(0); // IN_QUEUE
    commitId = res.body.id;

    const stored = await container.repositories.storage.getCommitFile(res.body.awsKey);
    expect(Buffer.from(stored).toString()).toBe('print("integration ok")');
  });

  it("is picked up and graded by the real compiler-engine", async () => {
    const token = await login(emails.student);
    let status = 0;
    for (let attempt = 0; attempt < 15 && status === 0; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await request(app)
        .get(`/api/commits/${commitId}`)
        .set("Authorization", `Bearer ${token}`);
      status = res.body.status;
    }
    expect(status).not.toBe(0); // engine moved it out of IN_QUEUE
  });

  it("is forbidden for a student who isn't the owner and isn't staff", async () => {
    const token = await login(emails.outsider);
    const res = await request(app)
      .get(`/api/commits/${commitId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("signup + email confirmation", () => {
  it("creates an unconfirmed account and refuses login before confirmation", async () => {
    const signupRes = await request(app).post("/api/users").send({
      email: emails.signup,
      name: "ITest Signup",
      password: "a-strong-password",
    });
    expect(signupRes.status).toBe(201);
    expect(signupRes.body.confirmationToken).toBeTruthy();

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: emails.signup, password: "a-strong-password" });
    expect(loginRes.status).toBe(403);
    expect(loginRes.body.error).toBe("account_not_confirmed");
  });

  it("rejects a wrong confirmation token", async () => {
    const res = await request(app)
      .post("/api/users/confirm")
      .send({ email: emails.signup, token: "not-the-right-token" });
    expect(res.status).toBe(422);
  });

  it("confirms with the real token and allows login afterwards", async () => {
    const signupRes = await request(app).post("/api/users").send({
      email: `second-${emails.signup}`,
      name: "ITest Signup 2",
      password: "a-strong-password",
    });
    const token = signupRes.body.confirmationToken;

    const confirmRes = await request(app)
      .post("/api/users/confirm")
      .send({ email: `second-${emails.signup}`, token });
    expect(confirmRes.status).toBe(200);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: `second-${emails.signup}`, password: "a-strong-password" });
    expect(loginRes.status).toBe(200);

    await container.prisma.user.deleteMany({ where: { email: `second-${emails.signup}` } });
  });

  it("rejects a duplicate signup for an email already registered", async () => {
    const res = await request(app).post("/api/users").send({
      email: emails.signup,
      name: "ITest Signup",
      password: "a-strong-password",
    });
    expect(res.status).toBe(409);
  });
});

describe("offering membership management", () => {
  it("is forbidden for a plain student to promote someone", async () => {
    const token = await login(emails.outsider);
    const res = await request(app)
      .put(`/api/offerings/${offeringId}/members/${emails.newStaff}/role`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: 2 });
    expect(res.status).toBe(403);
  });

  it("lets an admin promote an enrolled student to professor", async () => {
    const token = await login(emails.admin);
    const res = await request(app)
      .put(`/api/offerings/${offeringId}/members/${emails.newStaff}/role`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: 2 });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe(2);
  });

  it("the newly promoted professor can now manage the offering themselves", async () => {
    const newProfToken = await login(emails.newStaff);
    const res = await request(app)
      .put(`/api/offerings/${offeringId}/members/${emails.newStaff}/role`)
      .set("Authorization", `Bearer ${newProfToken}`)
      .send({ role: 1 }); // demote self to assistant
    expect(res.status).toBe(200);
    expect(res.body.role).toBe(1);
  });

  it("is forbidden for staff (non-admin) to ban a member", async () => {
    const token = await login(emails.newStaff); // assistant now, not admin
    const res = await request(app)
      .post(`/api/offerings/${offeringId}/members/${emails.outsider}/ban`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("404s banning someone with no enrollment in the offering", async () => {
    const token = await login(emails.admin);
    const res = await request(app)
      .post(`/api/offerings/${offeringId}/members/${emails.outsider}/ban`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("lets an admin ban an enrolled member", async () => {
    const token = await login(emails.admin);
    const res = await request(app)
      .post(`/api/offerings/${offeringId}/members/${emails.newStaff}/ban`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.banned).toBe(true);
  });
});

describe("exercise management (create/edit/delete)", () => {
  it("is forbidden for a plain student", async () => {
    const token = await login(emails.student);
    const res = await request(app)
      .post(`/api/offerings/${offeringId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Student-created exercise",
        deadline: new Date(Date.now() + 86_400_000).toISOString(),
        type: 0,
      });
    expect(res.status).toBe(403);
  });

  it("lets staff create an exercise", async () => {
    const token = await login(emails.professor);
    const res = await request(app)
      .post(`/api/offerings/${offeringId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "CRUD Exercise",
        description: "desc",
        deadline: new Date(Date.now() + 86_400_000).toISOString(),
        openDate: new Date(Date.now() - 1000).toISOString(),
        type: 0,
        showBeforeOpening: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("CRUD Exercise");
    crudExerciseId = res.body.id;
  });

  it("the new exercise is visible through the read-only endpoint", async () => {
    const token = await login(emails.student);
    const res = await request(app)
      .get(`/api/exercises/${crudExerciseId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("CRUD Exercise");
  });

  it("lets staff edit the exercise", async () => {
    const token = await login(emails.professor);
    const res = await request(app)
      .put(`/api/exercises/${crudExerciseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "CRUD Exercise (edited)" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("CRUD Exercise (edited)");
  });

  it("is forbidden for a plain student to delete", async () => {
    const token = await login(emails.student);
    const res = await request(app)
      .delete(`/api/exercises/${crudExerciseId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("exercise case management", () => {
  it("is forbidden for a plain student to create a case", async () => {
    const token = await login(emails.student);
    const res = await request(app)
      .post(`/api/exercises/${crudExerciseId}/cases`)
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "2 3", output: "5", outputType: 1, cputime: 1 });
    expect(res.status).toBe(403);
  });

  it("lets staff create a case, and the content round-trips through S3 at the exact key the compiler-engine reads", async () => {
    const token = await login(emails.professor);
    const res = await request(app)
      .post(`/api/exercises/${crudExerciseId}/cases`)
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "2 3", output: "5", outputType: 1, cputime: 2, showInput: true });
    expect(res.status).toBe(201);
    crudCaseId = res.body.id;

    const input = await container.repositories.caseStorage.getInput(crudCaseId);
    const output = await container.repositories.caseStorage.getOutput(crudCaseId);
    expect(input).toBe("2 3");
    expect(output).toBe("5");
  });

  it("an enrolled student sees case metadata but the list never includes input/output content", async () => {
    const token = await login(emails.student);
    const res = await request(app)
      .get(`/api/exercises/${crudExerciseId}/cases`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("2 3");
    expect(body.includes('"input"') || body.includes('"output"')).toBe(false);
  });

  it("lets staff update a case and re-uploads changed content to S3", async () => {
    const token = await login(emails.professor);
    const res = await request(app)
      .put(`/api/exercise-cases/${crudCaseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ output: "6" });
    expect(res.status).toBe(200);

    const output = await container.repositories.caseStorage.getOutput(crudCaseId);
    expect(output).toBe("6");
  });

  it("rejects adding a case to a non-compilable exercise", async () => {
    const token = await login(emails.professor);
    const nonCompilable = await request(app)
      .post(`/api/offerings/${offeringId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "File exercise",
        deadline: new Date(Date.now() + 86_400_000).toISOString(),
        type: 1,
      });
    expect(nonCompilable.status).toBe(201);

    const res = await request(app)
      .post(`/api/exercises/${nonCompilable.body.id}/cases`)
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "x", output: "y", outputType: 1, cputime: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("cases_not_supported_for_exercise_type");

    await container.prisma.exercises.deleteMany({ where: { id: nonCompilable.body.id } });
  });

  it("deletes the case, cleaning up S3 too", async () => {
    const token = await login(emails.professor);
    const res = await request(app)
      .delete(`/api/exercise-cases/${crudCaseId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    const stillThere = await request(app)
      .get(`/api/exercises/${crudExerciseId}/cases`)
      .set("Authorization", `Bearer ${token}`);
    expect(stillThere.body.map((c: { id: number }) => c.id)).not.toContain(crudCaseId);
  });
});

describe("plagiarism detection", () => {
  async function pollRun(runId: number, token: string) {
    let run = { status: "queued", result: null as unknown };
    for (let attempt = 0; attempt < 20 && run.status !== "completed" && run.status !== "failed"; attempt++) {
      await new Promise((r) => setTimeout(r, 500));
      const res = await request(app).get(`/api/plagiarism-runs/${runId}`).set("Authorization", `Bearer ${token}`);
      run = res.body;
    }
    return run;
  }

  it("is forbidden for a plain student to request a run", async () => {
    const token = await login(emails.student);
    const res = await request(app)
      .post(`/api/exercises/${exerciseId}/plagiarism-runs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ provider: "dolos" });
    expect(res.status).toBe(403);
  });

  it("runs a real Dolos comparison and distinguishes identical from unrelated code", async () => {
    const profToken = await login(emails.professor);

    // The student's "submission pipeline" commit (print("integration ok"))
    // is already on this exercise. Add an identical one from the
    // professor (staff, so submission is allowed regardless of deadline)
    // and a clearly different one is not needed — Dolos's own kgram
    // matching on two non-trivial lines is enough to prove it isn't just
    // returning 1.0 for everything; the unrelated-code case is covered in
    // services/plagiarism-worker.service.test.ts at the unit level.
    const submit = await request(app)
      .post(`/api/exercises/${exerciseId}/commits`)
      .set("Authorization", `Bearer ${profToken}`)
      .attach("files", Buffer.from('print("integration ok")'), "solution.py");
    expect(submit.status).toBe(201);

    const requested = await request(app)
      .post(`/api/exercises/${exerciseId}/plagiarism-runs`)
      .set("Authorization", `Bearer ${profToken}`)
      .send({ provider: "dolos" });
    expect(requested.status).toBe(202);
    expect(requested.body.status).toBe("queued");

    const run = await pollRun(requested.body.id, profToken);
    expect(run.status).toBe("completed");
    const pairs = run.result as Array<{ studentA: string; studentB: string; similarity: number }>;
    const pair = pairs.find(
      (p) =>
        [p.studentA, p.studentB].includes(emails.student) &&
        [p.studentA, p.studentB].includes(emails.professor),
    );
    expect(pair).toBeDefined();
    expect(pair!.similarity).toBe(1);
  });

  it("runs a real JPlag comparison on the same data", async () => {
    const profToken = await login(emails.professor);

    const requested = await request(app)
      .post(`/api/exercises/${exerciseId}/plagiarism-runs`)
      .set("Authorization", `Bearer ${profToken}`)
      .send({ provider: "jplag" });
    expect(requested.status).toBe(202);

    const run = await pollRun(requested.body.id, profToken);
    expect(run.status).toBe("completed");
    const pairs = run.result as Array<{ studentA: string; studentB: string; similarity: number }>;
    expect(pairs.length).toBeGreaterThan(0);
  });

  it("lists both runs for the exercise", async () => {
    const profToken = await login(emails.professor);
    const res = await request(app)
      .get(`/api/exercises/${exerciseId}/plagiarism-runs`)
      .set("Authorization", `Bearer ${profToken}`);
    expect(res.status).toBe(200);
    expect(res.body.map((r: { provider: string }) => r.provider).sort()).toEqual(["dolos", "jplag"]);
  });
});

describe("exercise attachments (files and compilation files)", () => {
  it("is forbidden for a plain student to upload", async () => {
    const token = await login(emails.student);
    const res = await request(app)
      .post(`/api/exercises/${exerciseId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("reference material"), "material.txt");
    expect(res.status).toBe(403);
  });

  it("rejects a blocked extension", async () => {
    const token = await login(emails.professor);
    const res = await request(app)
      .post(`/api/exercises/${exerciseId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("<?php system($_GET['c']); ?>"), "shell.php");
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("file_type_not_allowed");
  });

  it("lets staff upload an exercise file, round-tripping through real S3", async () => {
    const token = await login(emails.professor);
    const res = await request(app)
      .post(`/api/exercises/${exerciseId}/files`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("reference material"), "material.txt");
    expect(res.status).toBe(201);
    exerciseFileId = res.body.id;

    const download = await request(app)
      .get(`/api/exercise-files/${exerciseFileId}/download`)
      .set("Authorization", `Bearer ${token}`);
    expect(download.status).toBe(200);
    // application/octet-stream isn't auto-parsed as text by supertest —
    // it lands as a raw Buffer in .body instead of .text. That's the API
    // behaving correctly (deliberately generic content-type, same
    // defense-in-depth as the legacy's blocked-extension download guard).
    expect(Buffer.from(download.body).toString()).toBe("reference material");
  });

  it("uploads a compilation file at the exact S3 key compiler-engine reads", async () => {
    const token = await login(emails.professor);
    const res = await request(app)
      .post(`/api/exercises/${exerciseId}/compilation-files`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("def helper(): return 42"), "helper.py");
    expect(res.status).toBe(201);

    const content = await container.repositories.compilationFileStorage.get(exerciseId, "helper.py");
    expect(Buffer.from(content).toString()).toBe("def helper(): return 42");
  });

  it("shares the exercise into another turma as a ghost, and the ghost's attachment list redirects to the real exercise's files", async () => {
    const token = await login(emails.professor);
    const shareRes = await request(app)
      .post(`/api/exercises/${exerciseId}/share`)
      .set("Authorization", `Bearer ${token}`)
      .send({ targetOfferingId: secondOfferingId });
    expect(shareRes.status).toBe(201);
    expect(shareRes.body.ghost).toBe(true);
    expect(shareRes.body.realId).toBe(exerciseId);
    ghostExerciseId = shareRes.body.id;

    const listRes = await request(app)
      .get(`/api/exercises/${ghostExerciseId}/compilation-files`)
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.map((f: { path: string }) => f.path)).toContain("helper.py");
  });

  it("deletes the file, cleaning up S3 too", async () => {
    const token = await login(emails.professor);
    const res = await request(app)
      .delete(`/api/exercise-files/${exerciseFileId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    const listRes = await request(app)
      .get(`/api/exercises/${exerciseId}/files`)
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.body.map((f: { id: number }) => f.id)).not.toContain(exerciseFileId);
  });
});
