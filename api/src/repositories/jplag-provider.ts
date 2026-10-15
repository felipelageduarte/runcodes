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

/** Shells out to the JPlag CLI jar (Java). Requires a JVM on whatever
 * machine runs the plagiarism worker — see docs roadmap for why that
 * means its own process, not bundled into the API's deploy. */
export class JPlagProvider implements PlagiarismProvider {
  readonly name = "jplag" as const;

  constructor(private readonly jarPath: string) {}

  async compare(submissions: SubmissionFile[]): Promise<PlagiarismComparisonResult> {
    if (submissions.length < 2) return { pairs: [] };

    const extension = extensionOf(submissions[0].filename);
    const language = languageFor(extension, "jplag");
    if (!language) {
      throw new ValidationError(
        `Unsupported language for plagiarism check: .${extension}`,
        "unsupported_plagiarism_language",
      );
    }

    const root = await mkdtemp(join(tmpdir(), "jplag-"));
    try {
      const emailByDir: string[] = [];
      for (let i = 0; i < submissions.length; i++) {
        const sub = submissions[i];
        const dirName = String(i);
        const dir = join(root, "submissions", dirName);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, sub.filename), sub.content, "utf8");
        emailByDir[i] = sub.studentEmail;
      }

      const resultFile = join(root, "result");
      await execFileAsync(
        "java",
        [
          "-jar",
          this.jarPath,
          join(root, "submissions"),
          "-l",
          language,
          "-t",
          "1", // JPlag's default (12) rejects any realistically short exercise solution as "below the minimum match length" and aborts the whole run instead of just scoring it low — 1 is the most permissive setting, letting the similarity score (not a hard token-count cutoff) do the discriminating
          "-r",
          resultFile,
          "--csv-export",
          "-M",
          "RUN",
        ],
        { timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
      );

      const csv = await readFile(join(resultFile, "results.csv"), "utf8");
      return { pairs: parseResultsCsv(csv, emailByDir) };
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}

function parseResultsCsv(csv: string, emailByDir: string[]): SimilarityPair[] {
  const rows = parseCsv(csv, { columns: true, skip_empty_lines: true }) as Array<{
    submissionName1: string;
    submissionName2: string;
    averageSimilarity: string;
  }>;
  return rows.map((row) => ({
    studentA: emailByDir[Number(row.submissionName1)],
    studentB: emailByDir[Number(row.submissionName2)],
    similarity: Number(row.averageSimilarity),
  }));
}
