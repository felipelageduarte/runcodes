import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { buildContainer, type Container } from "../container.js";
import { buildApp } from "../app.js";

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
};

let container: Container;
let app: ReturnType<typeof buildApp>;

let courseId: number;
let offeringId: number;
let exerciseId: number;
let commitId: number;

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
});

afterAll(async () => {
  const prisma = container.prisma;
  await prisma.commits_exercise_cases.deleteMany({ where: { commit_id: commitId } }).catch(() => {});
  await prisma.commits.deleteMany({ where: { exercise_id: exerciseId } }).catch(() => {});
  await prisma.allowed_files_exercises.deleteMany({ where: { exercise_id: exerciseId } }).catch(() => {});
  await prisma.exercises.deleteMany({ where: { id: exerciseId } }).catch(() => {});
  await prisma.enrollments.deleteMany({ where: { offering_id: offeringId } }).catch(() => {});
  await prisma.offerings.deleteMany({ where: { id: offeringId } }).catch(() => {});
  await prisma.courses.deleteMany({ where: { id: courseId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } }).catch(() => {});
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
