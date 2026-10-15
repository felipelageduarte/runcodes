import type { ExerciseRepository } from "../repositories/exercise.repository.js";
import type { CommitRepository } from "../repositories/commit.repository.js";

export type DifficultyBucket = "easy" | "medium" | "hard";

export interface ExerciseMarketplaceStats {
  exerciseId: number;
  adoptionCount: number;
  totalSubmitters: number;
  avgAttemptsToSuccess: number;
  avgScore: number;
  passRate: number;
  /** Bucket shown in the UI — null when there's no data yet to judge
   * difficulty from (nobody has submitted to any copy). */
  difficultyBucket: DifficultyBucket | null;
}

const APPROVED_SCORE_THRESHOLD = 5;

function bucketFor(avgAttemptsToSuccess: number, passRate: number): DifficultyBucket {
  if (passRate < 40 || avgAttemptsToSuccess > 5) return "hard";
  if (passRate > 75 && avgAttemptsToSuccess <= 2) return "easy";
  return "medium";
}

/**
 * Marketplace dificuldade "calculada" (docs/frontend/marketplace.md,
 * gap #3) — agrega commits de TODAS as cópias de um exercício (o
 * original + cada ghost cujo real_id aponta pra ele), porque cada
 * turma que adota gera commits contra o id da sua própria cópia, não
 * contra o original. Agregação on-demand em memória, sem view
 * materializada — volume baixo o suficiente por enquanto (mesma
 * decisão documentada pro catálogo do marketplace em si); revisitar
 * se crescer.
 */
export class MarketplaceStatsService {
  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly commits: CommitRepository,
  ) {}

  async getStats(exerciseId: number): Promise<ExerciseMarketplaceStats> {
    const [ghosts, totalCases] = await Promise.all([
      this.exercises.findGhosts(exerciseId),
      this.exercises.countCases(exerciseId),
    ]);
    const copyIds = [exerciseId, ...ghosts.map((g) => g.id)];

    const latestPerCopy = await Promise.all(
      copyIds.map((copyId) => this.commits.listLatestPerStudentForExercise(copyId)),
    );
    // Pairs with which copy each submitter's latest commit belongs to —
    // needed below to fetch THAT student's full history on THAT copy,
    // not every copy (a student only ever submits to their own turma's
    // instance of the exercise).
    const submitterPairs = copyIds.flatMap((copyId, i) =>
      latestPerCopy[i].map((commit) => ({ copyId, email: commit.userEmail })),
    );
    const latestCommits = latestPerCopy.flat();

    const submitters = new Set(latestCommits.map((c) => c.userEmail));
    const scores = latestCommits.map((c) => Number(c.score ?? 0));
    const passCount = scores.filter((s) => s > APPROVED_SCORE_THRESHOLD).length;

    const avgAttemptsToSuccess =
      totalCases > 0 ? await this.averageAttemptsToSuccess(submitterPairs, totalCases) : 0;

    const total = scores.length;
    const passRate = total > 0 ? (passCount / total) * 100 : 0;
    const avgScore = total > 0 ? scores.reduce((a, b) => a + b, 0) / total : 0;

    return {
      exerciseId,
      adoptionCount: ghosts.length,
      totalSubmitters: submitters.size,
      avgAttemptsToSuccess,
      avgScore,
      passRate,
      difficultyBucket: total > 0 ? bucketFor(avgAttemptsToSuccess, passRate) : null,
    };
  }

  /** Só entram no cálculo alunos que CHEGARAM a acertar — quem nunca
   * resolveu é excluído do numerador/denominador, não contado como
   * "infinitas tentativas" (enviesaria a média pra qualquer exercício
   * com um aluno que desistiu). Por isso essa métrica nunca aparece
   * isolada na UI, sempre ao lado de passRate — juntas não enviesam,
   * cada uma sozinha sim. */
  private async averageAttemptsToSuccess(
    pairs: { copyId: number; email: string }[],
    totalCases: number,
  ): Promise<number> {
    const attempts = await Promise.all(
      pairs.map(async ({ copyId, email }) => {
        const history = await this.commits.listForUserOnExercise(copyId, email);
        const ascending = [...history].reverse();
        const successIndex = ascending.findIndex((c) => (c.corrects ?? 0) >= totalCases);
        return successIndex === -1 ? null : successIndex + 1;
      }),
    );

    const successes = attempts.filter((a): a is number => a !== null);
    if (successes.length === 0) return 0;
    return successes.reduce((a, b) => a + b, 0) / successes.length;
  }
}
