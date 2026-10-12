export interface SubmissionFile {
  studentEmail: string;
  filename: string;
  content: string;
}

export interface SimilarityPair {
  studentA: string;
  studentB: string;
  /** 0..1 */
  similarity: number;
}

export interface PlagiarismComparisonResult {
  pairs: SimilarityPair[];
}

/**
 * One implementation per external tool (Dolos, JPlag — MOSS stays out of
 * scope, see docs roadmap: it depends on a third-party Stanford service
 * instead of running locally). Services depend on this interface only,
 * never on `child_process`/CLI details directly — swapping or adding a
 * tool never touches PlagiarismService.
 */
export interface PlagiarismProvider {
  readonly name: "dolos" | "jplag";
  compare(submissions: SubmissionFile[]): Promise<PlagiarismComparisonResult>;
}
