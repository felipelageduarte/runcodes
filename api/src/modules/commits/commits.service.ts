import { createHash, randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../../lib/prisma.js";
import { s3, buckets } from "../../lib/s3.js";
import { CommitStatus, CompilableExerciseTypes } from "../../lib/constants.js";

export class ExerciseClosedError extends Error {}
export class FileTypeNotAllowedError extends Error {}
export class FileTooLargeError extends Error {}

const COMPILABLE_MAX_SIZE = 1_000_000;

async function getAllowedExtensions(exerciseId: number, realId: number | null) {
  const links = await prisma.allowed_files_exercises.findMany({
    where: { exercise_id: realId ?? exerciseId },
    select: { allowed_file_id: true },
  });
  const ids = links.map((l) => l.allowed_file_id).filter((id): id is number => id !== null);
  if (ids.length === 0) return [];
  const files = await prisma.allowed_files.findMany({ where: { id: { in: ids } } });
  return files.map((f) => f.extension.replace(/^\*\./, "").toLowerCase());
}

function extensionOf(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.slice(1).join(".").toLowerCase() : "";
}

export interface SubmitCommitInput {
  exerciseId: number;
  userEmail: string;
  ip: string | null;
  file: { originalname: string; buffer: Buffer };
}

/** Mirrors ExercisesController::commit(). Throws on validation failures;
 * the route maps those to the right HTTP status. */
export async function submitCommit(input: SubmitCommitInput, isStaff: boolean) {
  const exercise = await prisma.exercises.findUnique({ where: { id: input.exerciseId } });
  if (!exercise || exercise.removed) return null;

  const now = new Date();
  const isOpen =
    exercise.open_date !== null && exercise.open_date <= now && exercise.deadline > now;

  if (!isOpen && !isStaff) {
    throw new ExerciseClosedError();
  }

  const allowed = await getAllowedExtensions(exercise.id, exercise.ghost ? exercise.real_id : null);
  const ext = extensionOf(input.file.originalname);
  if (allowed.length > 0 && !allowed.includes(ext)) {
    throw new FileTypeNotAllowedError();
  }

  const isCompilable = CompilableExerciseTypes.includes(exercise.type);
  const maxSize = isCompilable ? COMPILABLE_MAX_SIZE : 5_000_000;
  if (input.file.buffer.length > maxSize) {
    throw new FileTooLargeError();
  }

  const key = `${exercise.id}/${randomUUID()}-${input.file.originalname}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: buckets.commits,
      Key: key,
      Body: input.file.buffer,
    }),
  );

  const hash = createHash("sha1").update(input.file.buffer).digest("hex");

  const commit = await prisma.commits.create({
    data: {
      user_email: input.userEmail,
      exercise_id: exercise.id,
      status: isCompilable ? CommitStatus.IN_QUEUE : CommitStatus.SUBMITTED,
      hash,
      aws_key: key,
      ip: input.ip,
    },
  });

  return commit;
}

export async function listCommitsForUser(exerciseId: number, userEmail: string) {
  return prisma.commits.findMany({
    where: { exercise_id: exerciseId, user_email: userEmail },
    orderBy: { commit_time: "desc" },
    select: {
      id: true,
      commit_time: true,
      status: true,
      corrects: true,
      score: true,
      compiled: true,
      compiled_message: true,
    },
  });
}

export async function getCommit(id: number) {
  return prisma.commits.findUnique({ where: { id } });
}
