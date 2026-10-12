import type { PrismaClient } from "@prisma/client";

export interface ExerciseCaseRecord {
  id: number;
  exerciseId: number;
  outputType: number;
  showInput: boolean | null;
  showExpectedOutput: boolean | null;
  showUserOutput: boolean | null;
  cputime: number;
  maxmemsize: number;
  stacksize: number;
  fileSize: number;
  absError: number | null;
  inputMd5: string | null;
  outputMd5: string | null;
}

export interface NewExerciseCase {
  exerciseId: number;
  outputType: number;
  showInput: boolean;
  showExpectedOutput: boolean;
  showUserOutput: boolean;
  cputime: number;
  maxmemsize: number;
  stacksize: number;
  fileSize: number;
  absError: number | null;
  inputMd5: string;
  outputMd5: string;
}

export interface ExerciseCasePatch {
  outputType?: number;
  showInput?: boolean;
  showExpectedOutput?: boolean;
  showUserOutput?: boolean;
  cputime?: number;
  maxmemsize?: number;
  stacksize?: number;
  absError?: number | null;
  inputMd5?: string;
  outputMd5?: string;
}

export interface ExerciseCaseRepository {
  findById(id: number): Promise<ExerciseCaseRecord | null>;
  listForExercise(exerciseId: number): Promise<ExerciseCaseRecord[]>;
  create(input: NewExerciseCase): Promise<ExerciseCaseRecord>;
  update(id: number, patch: ExerciseCasePatch): Promise<ExerciseCaseRecord | null>;
  delete(id: number): Promise<boolean>;
}

export class PrismaExerciseCaseRepository implements ExerciseCaseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: number): Promise<ExerciseCaseRecord | null> {
    const row = await this.prisma.exercise_cases.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async listForExercise(exerciseId: number): Promise<ExerciseCaseRecord[]> {
    const rows = await this.prisma.exercise_cases.findMany({
      where: { exercise_id: exerciseId },
      orderBy: { id: "asc" },
    });
    return rows.map(toRecord);
  }

  async create(input: NewExerciseCase): Promise<ExerciseCaseRecord> {
    const row = await this.prisma.exercise_cases.create({
      data: {
        exercise_id: input.exerciseId,
        input_type: 1,
        output_type: input.outputType,
        show_input: input.showInput,
        show_expected_output: input.showExpectedOutput,
        show_user_output: input.showUserOutput,
        cputime: input.cputime,
        maxmemsize: input.maxmemsize,
        stacksize: input.stacksize,
        file_size: input.fileSize,
        abs_error: input.absError,
        input_md5: input.inputMd5,
        output_md5: input.outputMd5,
      },
    });
    return toRecord(row);
  }

  async update(id: number, patch: ExerciseCasePatch): Promise<ExerciseCaseRecord | null> {
    try {
      const row = await this.prisma.exercise_cases.update({
        where: { id },
        data: {
          ...(patch.outputType !== undefined ? { output_type: patch.outputType } : {}),
          ...(patch.showInput !== undefined ? { show_input: patch.showInput } : {}),
          ...(patch.showExpectedOutput !== undefined ? { show_expected_output: patch.showExpectedOutput } : {}),
          ...(patch.showUserOutput !== undefined ? { show_user_output: patch.showUserOutput } : {}),
          ...(patch.cputime !== undefined ? { cputime: patch.cputime } : {}),
          ...(patch.maxmemsize !== undefined ? { maxmemsize: patch.maxmemsize } : {}),
          ...(patch.stacksize !== undefined ? { stacksize: patch.stacksize } : {}),
          ...(patch.absError !== undefined ? { abs_error: patch.absError } : {}),
          ...(patch.inputMd5 !== undefined ? { input_md5: patch.inputMd5 } : {}),
          ...(patch.outputMd5 !== undefined ? { output_md5: patch.outputMd5 } : {}),
          last_update: new Date(),
        },
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.exercise_cases.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}

function toRecord(row: {
  id: number;
  exercise_id: number;
  output_type: number;
  show_input: boolean | null;
  show_expected_output: boolean | null;
  show_user_output: boolean | null;
  cputime: number;
  maxmemsize: number;
  stacksize: number;
  file_size: number;
  abs_error: number | null;
  input_md5: string | null;
  output_md5: string | null;
}): ExerciseCaseRecord {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    outputType: row.output_type,
    showInput: row.show_input,
    showExpectedOutput: row.show_expected_output,
    showUserOutput: row.show_user_output,
    cputime: row.cputime,
    maxmemsize: row.maxmemsize,
    stacksize: row.stacksize,
    fileSize: row.file_size,
    absError: row.abs_error,
    inputMd5: row.input_md5,
    outputMd5: row.output_md5,
  };
}
