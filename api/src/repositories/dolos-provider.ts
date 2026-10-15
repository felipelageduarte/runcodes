import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse as parseCsv } from "csv-parse/sync";
import type {
  PlagiarismProvider,
  SubmissionFile,
  PlagiarismComparisonResult,
  SimilarityPair,
} from "./plagiarism-provider.js";
import { extensionOf } from "./plagiarism-fs-utils.js";
import { languageFor } from "../lib/plagiarismLanguage.js";
import { ValidationError } from "../domain/errors.js";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 120_000;

/** Shells out to the Dolos CLI (`@dodona/dolos`, TypeScript, npm-native —
 * no JVM, no external service — the reason it ships before JPlag/MOSS). */
export class DolosProvider implements PlagiarismProvider {
  readonly name = "dolos" as const;

  async compare(submissions: SubmissionFile[]): Promise<PlagiarismComparisonResult> {
    if (submissions.length < 2) return { pairs: [] };

    const extension = extensionOf(submissions[0].filename);
    const language = languageFor(extension, "dolos");
    if (!language) {
      throw new ValidationError(
        `Unsupported language for plagiarism check: .${extension}`,
        "unsupported_plagiarism_language",
      );
    }

    const root = await mkdtemp(join(tmpdir(), "dolos-"));
    try {
      const filesByIndex: string[] = [];
      const paths: string[] = [];
      for (let i = 0; i < submissions.length; i++) {
        const sub = submissions[i];
        const dir = join(root, String(i));
        await mkdir(dir, { recursive: true });
        const filePath = join(dir, sub.filename);
        await writeFile(filePath, sub.content, "utf8");
        filesByIndex[i] = sub.studentEmail;
        paths.push(filePath);
      }

      const reportDir = join(root, "report");
      await execFileAsync(
        "npx",
        ["--yes", "@dodona/dolos@2.9.3", "run", "-l", language, "-f", "csv", "-o", reportDir, ...paths],
        { timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
      );

      const csv = await readFile(join(reportDir, "pairs.csv"), "utf8");
      return { pairs: parsePairsCsv(csv, root, filesByIndex) };
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}

function studentIndexFromPath(filePath: string, root: string): number {
  // Dolos reports paths relative to the files it was given, like
  // "<root>/<index>/<filename>" — the index is the first path segment
  // after root.
  const relative = filePath.startsWith(root) ? filePath.slice(root.length) : filePath;
  const segment = relative.split(/[/\\]/).filter(Boolean)[0];
  return Number(segment);
}

function parsePairsCsv(csv: string, root: string, emailByIndex: string[]): SimilarityPair[] {
  const rows = parseCsv(csv, { columns: true, skip_empty_lines: true }) as Array<{
    leftFilePath: string;
    rightFilePath: string;
    similarity: string;
  }>;
  return rows.map((row) => ({
    studentA: emailByIndex[studentIndexFromPath(row.leftFilePath, root)],
    studentB: emailByIndex[studentIndexFromPath(row.rightFilePath, root)],
    similarity: Number(row.similarity),
  }));
}
